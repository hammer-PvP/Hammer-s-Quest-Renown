import {ID,assertGM,report,quests,esc} from "../constants.mjs";
import {setQuestAvailability,questFactionLabel} from "../services/documents.mjs";
import {questDeletionStatus,deleteQuest} from "../services/quest-deletion.mjs";
import {questCategory,normalizeQuestSearch,QUEST_CATEGORIES} from "../services/quest-manager-view.mjs";
import {QuestApp} from "./quest-app.mjs";
import {QuestLifecycleApp} from "./quest-lifecycle-app.mjs";
import {QuestResultsApp} from "./quest-results-app.mjs";
import {FailureReversalApp} from "./failure-reversal-app.mjs";
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;

export class QuestManagerApp extends HandlebarsApplicationMixin(ApplicationV2){
  static DEFAULT_OPTIONS={classes:["hqr-app","hqr-quest-manager"],position:{width:870,height:780},window:{title:"Quest Manager",resizable:true},tag:"section"};
  static PARTS={main:{template:`modules/${ID}/templates/quest-manager.hbs`}};
  constructor(opts={}){
    super(opts);
    this.search="";
    this.category="all";
    this._refreshQueued=false;
    this._pendingView=null;
    const queueRefresh=()=>{
      if(this._refreshQueued)return;
      this._refreshQueued=true;
      queueMicrotask(async()=>{
        try{await this._renderPreservingView();}catch{/* Closed window: no refresh necessary. */}
        finally{this._refreshQueued=false;}
      });
    };
    this._journalHook=Hooks.on("updateJournalEntry",(journal,changes)=>{
      if(journal.getFlag(ID,"kind")!=="quest")return;
      if(!("flags" in changes)&&!("name" in changes)&&!("folder" in changes))return;
      queueRefresh();
    });
    this._createHook=Hooks.on("createJournalEntry",journal=>{
      if(journal.getFlag(ID,"kind")==="quest")queueRefresh();
    });
    this._deleteHook=Hooks.on("deleteJournalEntry",journal=>{
      if(journal.getFlag(ID,"kind")==="quest")queueRefresh();
    });
  }
  async _onClose(options){
    for(const [event,key] of [["updateJournalEntry","_journalHook"],["createJournalEntry","_createHook"],["deleteJournalEntry","_deleteHook"]]){
      if(this[key]!=null){Hooks.off(event,this[key]);this[key]=null;}
    }
    await super._onClose?.(options);
  }
  /** Only an external Quest document update or explicit Refresh rerenders the window.
   * Filters and text search touch the existing DOM, never scroll or focus drafts.
   */
  async _renderPreservingView(){
    const root=this.element;
    const scroller=root?.querySelector(".hqr-scroll");
    const focused=root?.contains(document.activeElement)?document.activeElement:null;
    this._pendingView={scrollTop:scroller?.scrollTop??0,
      focus:focused?.name==="filter"?"search":focused?.hasAttribute("data-category")?focused.dataset.category:null,
      selectionStart:focused?.name==="filter"?focused.selectionStart:null,
      selectionEnd:focused?.name==="filter"?focused.selectionEnd:null};
    try{await this.render();}catch(error){this._pendingView=null;throw error;}
  }
  async _prepareContext(){
    assertGM();
    const entries=quests().map(q=>{
      const status=q.getFlag(ID,"status")??"unavailable";
      const faction=questFactionLabel(q.getFlag(ID,"factionUuid"));
      const assignees=q.getFlag(ID,"assignees")??[];
      const progress=q.getFlag(ID,"progress")??{};
      const counts={completed:0,failed:0,active:0};
      for(const id of assignees){
        const s=progress[id]?.status??"accepted";
        if(s==="completed")counts.completed++;
        else if(s==="failed")counts.failed++;
        else counts.active++;
      }
      const category=questCategory(status,counts.active);
      const canGive=status==="available";
      const canTurnIn=canGive && (counts.active>0 || !!q.getFlag(ID,"activeTurnIn"));
      const failPending=!!q.getFlag(ID,"activeFailureTurnIn");
      const canFail=(status==="available"||status==="inactive") &&
        (counts.active>0 || failPending || assignees.some(id=>progress[id]?.reason==="Quest became Inactive"&&!progress[id]?.failurePayoutId));
      const hasHistory=(q.getFlag(ID,"payouts")??[]).length>0||(q.getFlag(ID,"failurePayouts")??[]).length>0||counts.failed>0;
      const hasUndo=counts.failed>0 || !!q.getFlag(ID,"activeFailureReversal");
      const deletion=questDeletionStatus(q);
      return {id:q.id,name:q.name,faction,status,category,
        statusLabel:status==="inactive"?"Finished":status.replaceAll("-"," "),
        total:assignees.length,...counts,canGive,canTurnIn,canFail,hasHistory,hasUndo,
        canDelete:deletion.allowed,deleteReason:deletion.reason??"",
        hasPendingUnavailable:status==="unavailable"&&counts.active>0,
        canMakeAvailable:status!=="available",canMakeUnavailable:status==="available",canMakeInactive:status!=="inactive",isInactive:status==="inactive"};
    });
    return {entries,query:this.search,total:entries.length};
  }
  _applyFilters(){
    const root=this.element;
    if(!root)return;
    const needle=normalizeQuestSearch(this.search);
    const counts=Object.fromEntries(QUEST_CATEGORIES.map(category=>[category,0]));
    let visible=0;
    const rows=root.querySelectorAll(".hqr-quest-record");
    for(const row of rows){
      const matches=!needle||normalizeQuestSearch(`${row.dataset.questName??""} ${row.dataset.factionName??""}`).includes(needle);
      const kind=row.dataset.category;
      if(matches){counts.all++;if(Object.hasOwn(counts,kind))counts[kind]++;}
      const show=matches&&(this.category==="all"||kind===this.category);
      row.hidden=!show;
      if(show)visible++;
    }
    for(const button of root.querySelectorAll("[data-category]")){
      const kind=button.dataset.category;
      button.classList.toggle("is-active",kind===this.category);
      button.setAttribute("aria-pressed",String(kind===this.category));
      const count=button.querySelector(".hqr-filter-count");
      if(count)count.textContent=String(counts[kind]??0);
    }
    const message=root.querySelector(".hqr-quest-empty-filter");
    if(message){
      message.hidden=visible>0 || rows.length===0;
      const text=message.querySelector(".hqr-empty-text");
      if(text)text.textContent=counts.all===0&&needle?"No Quests match this search.":"No Quests match the selected filter.";
    }
    const shown=root.querySelector("[data-visible-quests]");
    if(shown)shown.textContent=String(visible);
  }
  _onRender(){
    const root=this.element;
    root.querySelector('[data-action="new"]')?.addEventListener("click",()=>new QuestApp().render(true));
    root.querySelector('[name="filter"]')?.addEventListener("input",event=>{
      this.search=event.target.value;
      this._applyFilters();
    });
    for(const button of root.querySelectorAll("[data-category]")){
      button.addEventListener("click",()=>{
        this.category=button.dataset.category;
        this._applyFilters();
      });
    }
    root.querySelector('[data-action="refresh"]')?.addEventListener("click",()=>this._renderPreservingView().catch(error=>report(error,"Quest Manager refresh failed")));
    this._applyFilters();
    const pending=this._pendingView;
    this._pendingView=null;
    if(pending){
      const scroller=root.querySelector(".hqr-scroll");
      if(scroller)scroller.scrollTop=pending.scrollTop;
      const focus=pending.focus==="search"?root.querySelector('[name="filter"]'):
        pending.focus?root.querySelector(`[data-category="${pending.focus}"]`):null;
      if(focus){
        focus.focus({preventScroll:true});
        if(pending.focus==="search"&&pending.selectionStart!==null){
          focus.setSelectionRange(pending.selectionStart,pending.selectionEnd??pending.selectionStart);
        }
      }
    }
    root.querySelectorAll("[data-quest-id]").forEach(row=>row.addEventListener("click",async event=>{
      const button=event.target.closest("[data-action]");if(!button)return;
      const journal=game.journal.get(row.dataset.questId);if(!journal)return;
      try{
        const action=button.dataset.action;
        if(action==="edit")new QuestApp(journal).render(true);
        else if(action==="open")journal.sheet?.render(true);
        else if(action==="give")new QuestLifecycleApp(journal,"giving").render(true);
        else if(action==="turnin")new QuestLifecycleApp(journal,"turnin").render(true);
        else if(action==="fail")new QuestLifecycleApp(journal,"failure").render(true);
        else if(action==="results")new QuestResultsApp(journal).render(true);
        else if(action==="undo-failure")new FailureReversalApp(journal).render(true);
        else if(action==="delete"){
          // Revalidate immediately before displaying the confirmation and again
          // in the service after confirmation: statuses may have changed meanwhile.
          const info=questDeletionStatus(journal);
          if(!info.allowed){ui.notifications.warn(`Cannot delete Quest: ${info.reason}`);return;}
          const detail=info.assigned
            ? `<p><strong>${info.assigned} Character(s)</strong> have received this Quest. Deleting it removes their access and unfinished progress; it does not modify their Actors.</p>`
            : `<p>This Quest has no assigned Characters.</p>`;
          const confirmed=await foundry.applications.api.DialogV2.confirm({
            window:{title:"Delete Quest Permanently"},
            content:`<p>Delete the Quest <strong>${esc(journal.name)}</strong> and its Journal pages, including GM Notes?</p>${detail}<p><strong>This cannot be undone.</strong> Quests with completed results, payouts, penalties or Actor reward records cannot be deleted.</p>`,
            yes:{label:"Delete Quest Permanently"},no:{label:"Cancel"}
          });
          if(!confirmed)return;
          await deleteQuest(journal);
          ui.notifications.info(`Quest deleted: ${journal.name}`);
        }
        else if(["available","unavailable","inactive"].includes(action)){
          if(action==="inactive"){
            const yes=await foundry.applications.api.DialogV2.confirm({window:{title:"Finish Quest"},
              content:`<p>Move <strong>${esc(journal.name)}</strong> to <strong>Hammer's Quests / Finished</strong>?</p><p>Assigned Characters keep their existing outcomes. <strong>No one is marked Failed automatically.</strong> Use the separate Failure Turn-In to record a failure.</p>`,
              yes:{label:"Finish Quest (No Automatic Failure)"},no:{label:"Cancel"}});
            if(!yes)return;
          }
          // The native updateJournalEntry hook refreshes the record after status changes.
          // Do not force a second render: it would interrupt scroll or focus.
          await setQuestAvailability(journal,action);
        }
      }catch(error){report(error,"Quest Manager action failed");}
    }));
  }
}
