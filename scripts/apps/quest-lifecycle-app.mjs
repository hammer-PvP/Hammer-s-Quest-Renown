import {ID,report,assertGM,eligible,groupMembers,CURRENCIES,esc} from "../constants.mjs";
import {giveQuest,getQuestParticipants,setQuestOutcome} from "../services/documents.mjs";
import {awardQuest} from "../services/reputation.mjs";
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
export class QuestLifecycleApp extends HandlebarsApplicationMixin(ApplicationV2){
  static DEFAULT_OPTIONS={classes:["hqr-app","hqr-lifecycle"],position:{width:780,height:780},window:{title:"Quest Giving & Turn-In",resizable:true},tag:"section"};
  static PARTS={main:{template:`modules/${ID}/templates/quest-lifecycle.hbs`}};
  constructor(doc,mode='giving',options={}){
    super(options);this.doc=doc;this.mode=mode;
    this.modeAssignment=doc?.getFlag(ID,'assignment')==='individual'?'individual':'group';
    this.groupId=doc?.getFlag(ID,'groupId')??game.actors.party?.id??"";
    this.people=doc?.getFlag(ID,'assignees')??[];
    this.renownScope=doc?.getFlag(ID,'assignment')==='individual'?'individual':(doc?.getFlag(ID,'renownScope')??"group");
    this.selectedParticipants=[];
    this.lootRecipientId=doc?.getFlag(ID,'lootRecipientId')??"";
  }
  async _prepareContext(){
    assertGM();
    const doc=this.doc;
    const status=doc?.getFlag(ID,'status')??'unavailable';
    const groups=game.actors.filter(a=>a.type==='group');
    const pcs=game.actors.filter(eligible);
    const participants=getQuestParticipants(doc);
    if(!this.selectedParticipants.length)this.selectedParticipants=participants.map(a=>a.id);
    const renown=Number(doc.getFlag(ID,'renown')??0);
    const curr=doc.getFlag(ID,'currency')??{};
    const items=doc.getFlag(ID,'items')??[];
    const hasLoot=CURRENCIES.some(k=>Number(curr[k])>0)||items.length>0;
    const isGiving=this.mode==='giving';
    const isGroupAssigned=doc.getFlag(ID,'assignment')==='group';
    return {name:doc.name,status,statusLabel:status.replaceAll('-',' '),isGiving,groupMode:this.modeAssignment==='group',
      groups:groups.map(g=>({id:g.id,name:g.name,selected:g.id===this.groupId})),
      pcs:pcs.map(a=>({id:a.id,name:a.name,checked:this.people.includes(a.id)})),
      groupPeople:groupMembers(game.actors.get(this.groupId)).map(a=>a.name),
      canGive:status==='available',canProgress:['offered','accepted','in-progress'].includes(status),
      completed:status==='completed',claimed:!!doc.getFlag(ID,'claimed'),
      scopeGroup:this.renownScope==='group',isGroupAssigned,
      participants:participants.map(a=>({id:a.id,name:a.name,checked:this.selectedParticipants.includes(a.id)})),
      renown,hasRenown:renown!==0,hasLoot,
      currency:CURRENCIES.filter(k=>Number(curr[k])>0).map(k=>({key:k.toUpperCase(),amount:curr[k]})),
      items:items.map(item=>({name:item.name,quantity:item.quantity})),
      inventoryActors:[...groups,...pcs].map(a=>({id:a.id,name:`${a.name} (${a.type})`,selected:this.lootRecipientId===a.id})),
      payoutPlan:doc.getFlag(ID,'payoutPlan')??null};
  }
  _onRender(){
    const root=this.element;
    root.querySelector('[name="assignment"]')?.addEventListener('change',e=>{this.modeAssignment=e.target.value;this._renderPreservingScroll();});
    root.querySelector('[name="groupId"]')?.addEventListener('change',e=>{this.groupId=e.target.value;this._renderPreservingScroll();});
    root.querySelector('[name="renownScope"]')?.addEventListener('change',e=>{this.renownScope=e.target.value;this._renderPreservingScroll();});
    root.querySelectorAll('[name="assignees"]')?.forEach(el=>el.addEventListener('change',()=>this.people=[...root.querySelectorAll('[name="assignees"]:checked')].map(x=>x.value)));
    root.querySelectorAll('[name="participants"]')?.forEach(el=>el.addEventListener('change',()=>this.selectedParticipants=[...root.querySelectorAll('[name="participants"]:checked')].map(x=>x.value)));
    root.querySelector('[name="lootRecipientId"]')?.addEventListener('change',e=>this.lootRecipientId=e.target.value);
    root.querySelector('[data-action="give"]')?.addEventListener('click',async()=>{
      try{
        await giveQuest(this.doc,{assignment:this.modeAssignment,groupId:this.groupId,assignees:this.people,status:root.querySelector('[name="givenStatus"]')?.value??'offered'});
        ui.notifications.info(`Quest assigned: ${this.doc.name}`);await this.render();
      }catch(e){report(e,'Quest Giving failed');}
    });
    root.querySelector('[data-action="change-status"]')?.addEventListener('click',async()=>{
      try{await setQuestOutcome(this.doc,root.querySelector('[name="progressStatus"]').value);await this.render();ui.notifications.info('Quest status updated.');}
      catch(e){report(e,'Update Quest status failed');}
    });
    root.querySelector('[data-action="issue"]')?.addEventListener('click',async()=>{
      try{
        if(this.doc.getFlag(ID,'claimed'))throw new Error('Rewards already issued.');
        const renown=Number(this.doc.getFlag(ID,'renown')??0);
        const hasLoot=CURRENCIES.some(k=>Number(this.doc.getFlag(ID,'currency')?.[k])>0)||(this.doc.getFlag(ID,'items')??[]).length>0;
        if(renown && this.renownScope==='group' && this.doc.getFlag(ID,'assignment')!=='group')throw new Error('Shared Renown requires a Group-assigned Quest; use Individual Participants.');
        if(hasLoot && !this.lootRecipientId)throw new Error('Choose a destination for Currency & Items.');
        if(renown && this.renownScope==='individual' && !this.selectedParticipants.length)throw new Error('Select eligible Participants to receive Renown.');
        const yes=await foundry.applications.api.DialogV2.confirm({window:{title:'Confirm Quest Turn-In'},
          content:`<p>Complete <strong>${esc(this.doc.name)}</strong> and distribute the rewards?</p><p>This records permanent Actor changes and prevents duplicate grants.</p>`,
          yes:{label:'Complete & Grant'},no:{label:'Cancel'}});
        if(!yes)return;
        await setQuestOutcome(this.doc,'completed');
        await awardQuest(this.doc,{scope:this.renownScope,participantIds:this.selectedParticipants,lootRecipientId:this.lootRecipientId});
        await this.render();
      }catch(e){report(e,'Quest Turn-In failed');}
    });
    root.querySelector('[data-action="open"]')?.addEventListener('click',()=>this.doc.sheet?.render(true));
  }
  async _renderPreservingScroll(){const s=this.element.querySelector('.hqr-scroll')?.scrollTop??0;await this.render();const scroll=this.element.querySelector('.hqr-scroll');if(scroll)scroll.scrollTop=s;}
}
