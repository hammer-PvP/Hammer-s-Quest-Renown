import {ID,assertGM,report,quests,factions,esc} from "../constants.mjs";
import {setQuestAvailability} from "../services/documents.mjs";
import {QuestApp} from "./quest-app.mjs";
import {QuestLifecycleApp} from "./quest-lifecycle-app.mjs";
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
export class QuestManagerApp extends HandlebarsApplicationMixin(ApplicationV2){
  static DEFAULT_OPTIONS={classes:["hqr-app","hqr-quest-manager"],position:{width:870,height:780},window:{title:"Quest Manager",resizable:true},tag:"section"};
  static PARTS={main:{template:`modules/${ID}/templates/quest-manager.hbs`}};
  constructor(opts={}){super(opts);this.search="";}
  async _prepareContext(){
    assertGM();
    const entries=quests().map(q=>{
      const status=q.getFlag(ID,"status")??"unavailable";
      const faction=factions().find(f=>f.uuid===q.getFlag(ID,"factionUuid"));
      const assignment=q.getFlag(ID,"assignment");
      const assigned=assignment==="group"?(game.actors.get(q.getFlag(ID,"groupId"))?.name??"Unassigned"):
        assignment==="individual"?(q.getFlag(ID,"assignees")??[]).map(id=>game.actors.get(id)?.name).filter(Boolean).join(", "):"Unassigned";
      return {id:q.id,name:q.name,faction:faction?.name??"Unlinked",status,statusLabel:status.replaceAll("-"," "),assigned,
        canGive:status==="available",canTurnIn:["offered","accepted","in-progress","completed","failed","abandoned"].includes(status),
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
        else if(action==='turnin')new QuestLifecycleApp(journal,'turnin').render(true);
        else if(action==='toggle'){
          await setQuestAvailability(journal,journal.getFlag(ID,'status')!=='available');
          await this.render();
        }
      }catch(err){report(err,'Quest Manager action failed');}
    }));
  }
}
