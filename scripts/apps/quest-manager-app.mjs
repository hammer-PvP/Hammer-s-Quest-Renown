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
    this._journalHook=Hooks.on('updateJournalEntry',(journal,changes)=>{
      if(journal.getFlag(ID,'kind')!=='quest')return;
      if(!('flags' in changes) && !('name' in changes) && !('folder' in changes))return;
      if(this._refreshQueued)return;
      this._refreshQueued=true;
      queueMicrotask(async()=>{this._refreshQueued=false;try{await this.render();}catch{ /* closed app */ }});
    });
  }
  async _onClose(options){
    if(this._journalHook!==null){Hooks.off('updateJournalEntry',this._journalHook);this._journalHook=null;}
    await super._onClose?.(options);
  }
  async _prepareContext(){
    assertGM();
    const entries=quests().map(q=>{
      const status=q.getFlag(ID,"status")??"unavailable";
      const faction=factions().find(f=>f.uuid===q.getFlag(ID,"factionUuid"));
      const assignment=q.getFlag(ID,"assignment");
      const assigned=assignment==="individual"?(q.getFlag(ID,"assignees")??[]).map(id=>game.actors.get(id)?.name).filter(Boolean).join(", "):"Unassigned";
      return {id:q.id,name:q.name,faction:faction?.name??"Unlinked",status,statusLabel:status.replaceAll("-"," "),assigned,
        canGive:status==="available",canTurnIn:!q.getFlag(ID,"claimed") && ["offered","accepted","in-progress","completed"].includes(status),
        canViewResults:!!q.getFlag(ID,"claimed") || ["failed","abandoned"].includes(status),
        canToggle:["unavailable","available"].includes(status),isAvailable:status==="available",claimed:!!q.getFlag(ID,"claimed")};
    });
    return {entries,query:this.search,total:entries.length};
  }
  _onRender(){
    const root=this.element;
    root.querySelector('[data-action="new"]')?.addEventListener('click',()=>new QuestApp().render(true));
    root.querySelector('[name="filter"]')?.addEventListener('input',e=>{
      this.search=e.target.value;
      const q=this.search.trim().toLocaleLowerCase();
      root.querySelectorAll('.hqr-quest-record').forEach(row=>{row.hidden=!!q&&!row.textContent.toLocaleLowerCase().includes(q);});
    });
    root.querySelector('[data-action="refresh"]')?.addEventListener('click',()=>this.render());
    root.querySelectorAll('[data-quest-id]').forEach(row=>row.addEventListener('click',async e=>{
      const button=e.target.closest('[data-action]');if(!button)return;
      const journal=game.journal.get(row.dataset.questId);if(!journal)return;
      try{
        const action=button.dataset.action;
        if(action==='edit')new QuestApp(journal).render(true);
        else if(action==='open')journal.sheet?.render(true);
        else if(action==='give')new QuestLifecycleApp(journal,'giving').render(true);
        else if(action==='turnin'){if(journal.getFlag(ID,'claimed'))throw new Error('Rewards already issued. Open View Results.');new QuestLifecycleApp(journal,'turnin').render(true);}
        else if(action==='results')new QuestResultsApp(journal).render(true);
        else if(action==='toggle'){
          await setQuestAvailability(journal,journal.getFlag(ID,'status')!=='available');
          await this.render();
        }
      }catch(err){report(err,'Quest Manager action failed');}
    }));
  }
}
