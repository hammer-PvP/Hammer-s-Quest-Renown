import {ID,report,assertGM,eligible,CURRENCIES,esc,factions} from "../constants.mjs";
import {giveQuest,getQuestParticipants,setQuestOutcome} from "../services/documents.mjs";
import {awardQuest,candidateGroups} from "../services/reputation.mjs";
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;

export class QuestLifecycleApp extends HandlebarsApplicationMixin(ApplicationV2){
  static DEFAULT_OPTIONS={classes:["hqr-app","hqr-lifecycle"],position:{width:780,height:780},window:{title:"Quest Giving & Turn-In",resizable:true},tag:"section"};
  static PARTS={main:{template:`modules/${ID}/templates/quest-lifecycle.hbs`}};
  constructor(doc,mode='giving',options={}){
    super(options);this.doc=doc;this.mode=mode;
    this.people=[...(doc?.getFlag(ID,'assignees')??[])];
    this.selectedParticipants=null; // null: first load from assigned eligible Characters. []: deliberate none.
    this.selectedGroups=[]; // Never implicitly award any Group.
    this.rowTargets={};
    this.lootRecipientId=doc?.getFlag(ID,'lootRecipientId')??"";
  }
  async _prepareContext(){
    assertGM();
    const doc=this.doc;
    const status=doc?.getFlag(ID,'status')??'unavailable';
    const pcs=game.actors.filter(eligible);
    const eligibleParticipants=getQuestParticipants(doc);
    const allowed=new Set(eligibleParticipants.map(a=>a.id));
    if(this.selectedParticipants===null)this.selectedParticipants=[...allowed];
    else this.selectedParticipants=this.selectedParticipants.filter(id=>allowed.has(id));
    const groups=candidateGroups(this.selectedParticipants);
    const groupIds=new Set(groups.map(g=>g.id));
    this.selectedGroups=this.selectedGroups.filter(id=>groupIds.has(id));
    const curr=doc.getFlag(ID,'currency')??{};
    const items=doc.getFlag(ID,'items')??[];
    const hasLoot=CURRENCIES.some(k=>Number(curr[k])>0)||items.length>0;
    const renown=(doc.getFlag(ID,'renownRewards')??[]).map(r=>{
      const setting=this.rowTargets[r.id]??{personal:true,group:true};
      return {...r,factionName:factions().find(f=>f.uuid===r.factionUuid)?.name??'Unknown Faction',
        amountLabel:Number(r.amount)>0?`+${r.amount}`:String(r.amount),positive:Number(r.amount)>=0,
        personal:setting.personal,group:setting.group};
    });
    const isGiving=this.mode==='giving';
    const claimed=!!doc.getFlag(ID,'claimed');
    return {name:doc.name,status,statusLabel:status.replaceAll('-',' '),isGiving,
      pcs:pcs.map(a=>({id:a.id,name:a.name,checked:this.people.includes(a.id)})),
      canGive:status==='available',canProgress:['offered','accepted','in-progress'].includes(status),
      canTurnIn:!claimed && ['offered','accepted','in-progress','completed'].includes(status),
      completed:status==='completed',claimed,
      participants:eligibleParticipants.map(a=>({id:a.id,name:a.name,checked:this.selectedParticipants.includes(a.id)})),
      groups:groups.map(g=>({id:g.id,name:g.name,checked:this.selectedGroups.includes(g.id),
        people:(g.system?.members??[]).filter(m=>this.selectedParticipants.includes(m.actor?.id??m.actor)).map(m=>game.actors.get(m.actor?.id??m.actor)?.name).filter(Boolean).join(', ')})),
      renown,hasRenown:renown.length>0,hasLoot,
      noGroups:groups.length===0,selectedGroupCount:this.selectedGroups.length,
      currency:CURRENCIES.filter(k=>Number(curr[k])>0).map(k=>({key:k.toUpperCase(),amount:curr[k]})),
      items:items.map(item=>({name:item.name,quantity:item.quantity})),
      inventoryActors:game.actors.filter(a=>['group','character'].includes(a.type)).map(a=>({id:a.id,name:`${a.name} (${a.type})`,selected:this.lootRecipientId===a.id})),
      payoutPlan:doc.getFlag(ID,'payoutPlan')??null};
  }
  _onRender(){
    const root=this.element;
    root.querySelectorAll('[name="assignees"]')?.forEach(el=>el.addEventListener('change',()=>{
      this.people=[...root.querySelectorAll('[name="assignees"]:checked')].map(x=>x.value);
    }));
    root.querySelectorAll('[name="participants"]')?.forEach(el=>el.addEventListener('change',async()=>{
      this.selectedParticipants=[...root.querySelectorAll('[name="participants"]:checked')].map(x=>x.value);
      await this._renderPreservingScroll();
    }));
    root.querySelectorAll('[name="groups"]')?.forEach(el=>el.addEventListener('change',()=>{
      this.selectedGroups=[...root.querySelectorAll('[name="groups"]:checked')].map(x=>x.value);
    }));
    root.querySelectorAll('.hqr-turnin-renown-row').forEach(row=>row.querySelectorAll('input[type="checkbox"]').forEach(el=>{
      el.addEventListener('change',()=>{
        this.rowTargets[row.dataset.rewardId]={
          personal:row.querySelector('[name="targetPersonal"]')?.checked??false,
          group:row.querySelector('[name="targetGroup"]')?.checked??false
        };
      });
    }));
    root.querySelector('[name="lootRecipientId"]')?.addEventListener('change',e=>this.lootRecipientId=e.target.value);
    root.querySelector('[data-action="give"]')?.addEventListener('click',async()=>{
      try{
        await giveQuest(this.doc,{assignees:this.people,status:root.querySelector('[name="givenStatus"]')?.value??'offered'});
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
        if(!['offered','accepted','in-progress','completed'].includes(this.doc.getFlag(ID,'status')))throw new Error('Quest cannot be turned in from its current status.');
        const hasLoot=CURRENCIES.some(k=>Number(this.doc.getFlag(ID,'currency')?.[k])>0)||(this.doc.getFlag(ID,'items')??[]).length>0;
        if(hasLoot && !this.lootRecipientId && !this.doc.getFlag(ID,'payoutPlan'))throw new Error('Choose a destination for Currency & Items.');
        const locked=!!this.doc.getFlag(ID,'payoutPlan');
        const yes=await foundry.applications.api.DialogV2.confirm({window:{title:'Confirm Quest Turn-In'},
          content:locked
            ? `<p>Resume the original locked reward distribution for <strong>${esc(this.doc.name)}</strong>?</p><p>Previously selected recipients and payout targets will be used without changes.</p>`
            : `<p>Complete <strong>${esc(this.doc.name)}</strong> and distribute Renown to the selected Characters and explicitly checked Groups?</p><p><strong>${this.selectedGroups.length} Group(s)</strong> selected. Unchecked Groups receive nothing. This records permanent Actor changes.</p>`,
          yes:{label:'Complete & Grant'},no:{label:'Cancel'}});
        if(!yes)return;
        // A partially issued plan is frozen; retries use that snapshot irrespective of changed UI selections.
        if(this.doc.getFlag(ID,'status')!=='completed')await setQuestOutcome(this.doc,'completed');
        await awardQuest(this.doc,{participantIds:this.selectedParticipants,groupIds:this.selectedGroups,
          rowTargets:this.rowTargets,lootRecipientId:this.lootRecipientId});
        await this.render();
      }catch(e){report(e,'Quest Turn-In failed');}
    });
    root.querySelector('[data-action="open"]')?.addEventListener('click',()=>this.doc.sheet?.render(true));
  }
  async _renderPreservingScroll(){
    const s=this.element.querySelector('.hqr-scroll')?.scrollTop??0;
    await this.render();const scroll=this.element.querySelector('.hqr-scroll');if(scroll)scroll.scrollTop=s;
  }
}
