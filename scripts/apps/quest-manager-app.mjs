import {ID,assertGM,report,quests,factions,esc} from "../constants.mjs";
import {setQuestAvailability} from "../services/documents.mjs";
import {QuestApp} from "./quest-app.mjs";
import {QuestLifecycleApp} from "./quest-lifecycle-app.mjs";
import {QuestResultsApp} from "./quest-results-app.mjs";
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
export class QuestManagerApp extends HandlebarsApplicationMixin(ApplicationV2){
  static DEFAULT_OPTIONS={classes:["hqr-app","hqr-quest-manager"],position:{width:870,height:780},window:{title:"Quest Manager",resizable:true},tag:"section"};
  static PARTS={main:{template:`modules/${ID}/templates/quest-manager.hbs`}};
  constructor(opts={}){
    super(opts);this.search="";this._refreshQueued=false;
    this._journalHook=Hooks.on("updateJournalEntry",(journal,changes)=>{
      if(journal.getFlag(ID,"kind")!=="quest")return;
      if(!("flags" in changes)&&!("name" in changes)&&!("folder" in changes))return;
      if(this._refreshQueued)return;
      this._refreshQueued=true;
      queueMicrotask(async()=>{this._refreshQueued=false;try{await this.render();}catch{ /* window closed */ }});
    });
  }
  async _onClose(options){
    if(this._journalHook!==null){Hooks.off("updateJournalEntry",this._journalHook);this._journalHook=null;}
    await super._onClose?.(options);
  }
  async _prepareContext(){
    assertGM();
    const entries=quests().map(q=>{
      const status=q.getFlag(ID,"status")??"unavailable";
      const faction=factions().find(f=>f.uuid===q.getFlag(ID,"factionUuid"));
      const assignees=q.getFlag(ID,"assignees")??[];
      const progress=q.getFlag(ID,"progress")??{};
      const counts={completed:0,failed:0,active:0};
      for(const id of assignees){
        const s=progress[id]?.status??"accepted";
        if(s==="completed")counts.completed++;
        else if(s==="failed")counts.failed++;
        else counts.active++;
      }
      const canGive=status==="available";
      const canTurnIn=canGive && (counts.active>0 || !!q.getFlag(ID,"activeTurnIn"));
      const hasHistory=(q.getFlag(ID,"payouts")??[]).length>0||counts.failed>0;
      return {id:q.id,name:q.name,faction:faction?.name??"Unlinked",status,statusLabel:status.replaceAll("-"," "),
        total:assignees.length,...counts,canGive,canTurnIn,hasHistory,
        canMakeAvailable:status!=="available",canMakeUnavailable:status==="available",canMakeInactive:status!=="inactive",isInactive:status==="inactive"};
    });
    return {entries,query:this.search,total:entries.length};
  }
  _onRender(){
    const root=this.element;
    root.querySelector('[data-action="new"]')?.addEventListener("click",()=>new QuestApp().render(true));
    root.querySelector('[name="filter"]')?.addEventListener("input",event=>{
      this.search=event.target.value;
      const search=this.search.trim().toLocaleLowerCase();
      root.querySelectorAll(".hqr-quest-record").forEach(row=>{row.hidden=!!search&&!row.textContent.toLocaleLowerCase().includes(search);});
    });
    root.querySelector('[data-action="refresh"]')?.addEventListener("click",()=>this.render());
    root.querySelectorAll("[data-quest-id]").forEach(row=>row.addEventListener("click",async event=>{
      const button=event.target.closest("[data-action]");if(!button)return;
      const journal=game.journal.get(row.dataset.questId);if(!journal)return;
      try{
        const action=button.dataset.action;
        if(action==="edit")new QuestApp(journal).render(true);
        else if(action==="open")journal.sheet?.render(true);
        else if(action==="give")new QuestLifecycleApp(journal,"giving").render(true);
        else if(action==="turnin")new QuestLifecycleApp(journal,"turnin").render(true);
        else if(action==="results")new QuestResultsApp(journal).render(true);
        else if(["available","unavailable","inactive"].includes(action)){
          if(action==="inactive"){
            const pending=(journal.getFlag(ID,"assignees")??[]).filter(id=>!["completed","failed"].includes(journal.getFlag(ID,"progress")?.[id]?.status));
            const yes=await foundry.applications.api.DialogV2.confirm({window:{title:"Inactivate Quest"},
              content:`<p>Mark <strong>${esc(journal.name)}</strong> Inactive?</p><p><strong>${pending.length} unfinished Character(s)</strong> will be marked Failed. Completed Characters keep their results. Journal and history remain available.</p>`,
              yes:{label:"Inactivate & Mark Failed"},no:{label:"Cancel"}});
            if(!yes)return;
          }
          await setQuestAvailability(journal,action);await this.render();
        }
      }catch(error){report(error,"Quest Manager action failed");}
    }));
  }
}
