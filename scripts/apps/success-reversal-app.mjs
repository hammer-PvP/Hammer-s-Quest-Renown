import {ID,assertGM,report,esc} from '../constants.mjs';
import {completedCharacters,reversibleSuccessGroups,pendingSuccessReversal,undoQuestSuccess} from '../services/success-reversal.mjs';
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
export class SuccessReversalApp extends HandlebarsApplicationMixin(ApplicationV2){
 static DEFAULT_OPTIONS={classes:['hqr-app','hqr-undo-success'],position:{width:735,height:710},window:{title:'Undo Quest Success',resizable:true},tag:'section'};
 static PARTS={main:{template:`modules/${ID}/templates/success-reversal.hbs`}};
 constructor(doc,options={}){super(options);this.doc=doc;this.characterIds=[];this.groupIds=[];this.reason='';}
 async _prepareContext(){
   assertGM();const pending=pendingSuccessReversal(this.doc);
   const people=completedCharacters(this.doc),allowed=new Set(people.map(p=>p.id));
   this.characterIds=this.characterIds.filter(id=>allowed.has(id));
   const groups=reversibleSuccessGroups(this.doc,this.characterIds);
   this.groupIds=this.groupIds.filter(id=>groups.some(g=>g.id===id&&g.available));
   return {name:this.doc.name,pending:!!pending,pendingCount:pending?.characters?.length??0,
     selectedCount:this.characterIds.length,total:people.length,
     people:people.map(p=>({...p,checked:this.characterIds.includes(p.id)})),
     groups:groups.map(g=>({...g,checked:this.groupIds.includes(g.id)})),reason:this.reason};
 }
 _onRender(){
   const root=this.element;const selections=name=>[...root.querySelectorAll(`[name="${name}"]:checked:not(:disabled)`)].map(i=>i.value);
   root.querySelectorAll('[name="successCharacters"]').forEach(i=>i.addEventListener('change',async()=>{
     this.characterIds=selections('successCharacters');await this._refresh();
   }));
   root.querySelector('[data-action="all"]')?.addEventListener('click',async()=>{
     this.characterIds=completedCharacters(this.doc).map(x=>x.id);await this._refresh();
   });
   root.querySelector('[data-action="clear"]')?.addEventListener('click',async()=>{
     this.characterIds=[];this.groupIds=[];await this._refresh();
   });
   root.querySelectorAll('[name="successGroups"]').forEach(i=>i.addEventListener('change',()=>{
     this.groupIds=selections('successGroups');this._update();
   }));
   root.querySelector('[name="reason"]')?.addEventListener('input',e=>{this.reason=e.target.value;this._update();});
   root.querySelector('[data-action="undo"]')?.addEventListener('click',async event=>{
     const button=event.currentTarget;button.disabled=true;
     try{
       const pending=pendingSuccessReversal(this.doc);
       if(!pending&&(!this.characterIds.length||!this.reason.trim()))throw new Error('Select Completed Characters and a reason.');
       const confirmation=await foundry.applications.api.DialogV2.confirm({window:{title:'Confirm Undo Success'},
         content:pending?`<p>Resume the interrupted correction for <strong>${esc(this.doc.name)}</strong>?</p>`:
          `<p>Reverse Success for <strong>${this.characterIds.length} Character(s)</strong> and <strong>${this.groupIds.length} Group(s)</strong> on <strong>${esc(this.doc.name)}</strong>?</p><p>Paid Renown will be compensated, coins withdrawn and original awarded Items removed. This operation is blocked if Items were changed or money was spent. History is retained.</p><p><strong>Reason:</strong> ${esc(this.reason)}</p>`,
         yes:{label:pending?'Resume Correction':'Undo Selected Successes'},no:{label:'Cancel'}});
       if(!confirmation)return;
       await undoQuestSuccess(this.doc,{characterIds:this.characterIds,groupIds:this.groupIds,reason:this.reason});
       this.characterIds=[];this.groupIds=[];this.reason='';await this.render();
     }catch(error){report(error,'Undo Success failed');}
     finally{button.disabled=false;}
   });
   this._update();
 }
 _update(){const btn=this.element.querySelector('[data-action="undo"]');
   if(btn)btn.disabled=!pendingSuccessReversal(this.doc)&&(!this.characterIds.length||!this.reason.trim());
 }
 async _refresh(){const top=this.element.querySelector('.hqr-scroll')?.scrollTop??0;
   await this.render();const pane=this.element.querySelector('.hqr-scroll');if(pane)pane.scrollTop=top;
 }
}
