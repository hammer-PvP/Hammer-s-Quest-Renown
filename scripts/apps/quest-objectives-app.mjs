import {ID,assertGM,report,eligible,esc} from '../constants.mjs';
import {getQuestParticipants,questHTML,reconcileAccess} from '../services/documents.mjs';
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
export class QuestObjectivesApp extends HandlebarsApplicationMixin(ApplicationV2){
 static DEFAULT_OPTIONS={classes:['hqr-app','hqr-objective-tracker'],position:{width:710,height:660},window:{title:'Quest Objectives',resizable:true},tag:'section'};
 static PARTS={main:{template:`modules/${ID}/templates/quest-objectives.hbs`}};
 constructor(doc,options={}){super(options);this.doc=doc;this.selectedActorId='';}
 async _prepareContext(){
   assertGM();const d=this.doc,mode=d.getFlag(ID,'objectiveTracking')==='individual'?'individual':'global';
   const people=getQuestParticipants(d),ids=new Set(people.map(a=>a.id));
   if(!ids.has(this.selectedActorId))this.selectedActorId=people[0]?.id??'';
   const personal=d.getFlag(ID,'objectiveProgress')??{};
   return {name:d.name,individual:mode==='individual',hasPeople:people.length>0,
    people:people.map(a=>({id:a.id,name:a.name,selected:a.id===this.selectedActorId})),
    objectives:(d.getFlag(ID,'objectives')??[]).map(o=>({id:o.id,text:o.text,
      checked:mode==='individual'?!!personal[this.selectedActorId]?.[o.id]:!!o.done}))};
 }
 _onRender(){
   const root=this.element;
   root.querySelector('[name="actor"]')?.addEventListener('change',async e=>{this.selectedActorId=e.target.value;await this.render();});
   root.querySelectorAll('[data-objective-id]').forEach(input=>input.addEventListener('change',async()=>{
     try{
       assertGM();const id=input.dataset.objectiveId,mode=this.doc.getFlag(ID,'objectiveTracking')??'global';
       const objectives=[...(this.doc.getFlag(ID,'objectives')??[])];
       if(!objectives.some(o=>o.id===id))throw new Error('Objective has changed. Reopen the tracker.');
       if(mode==='individual'){
         const actor=game.actors.get(this.selectedActorId);
         if(!eligible(actor)||!(this.doc.getFlag(ID,'assignees')??[]).includes(actor.id))throw new Error('Select an assigned Character.');
         const state={...(this.doc.getFlag(ID,'objectiveProgress')??{})};
         state[actor.id]={...(state[actor.id]??{}),[id]:input.checked};
         await this.doc.setFlag(ID,'objectiveProgress',state);
       }else{
         const row=objectives.find(o=>o.id===id);row.done=input.checked;
         await this.doc.setFlag(ID,'objectives',objectives);
         const page=this.doc.pages.find(p=>!p.getFlag(ID,'gmOnly'));
         if(page)await page.update({'text.content':questHTML(this.doc.name,this.doc.flags[ID])});
       }
     }catch(error){input.checked=!input.checked;report(error,'Update objective failed');}
   }));
 }
}
