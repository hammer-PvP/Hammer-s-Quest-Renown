import {ID,report,assertGM,eligible,CURRENCIES,esc,factions} from "../constants.mjs";
import {giveQuest,getQuestParticipants,progressOf} from "../services/documents.mjs";
import {awardQuest,failQuest,candidateGroups} from "../services/reputation.mjs";
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;

export class QuestLifecycleApp extends HandlebarsApplicationMixin(ApplicationV2){
  static DEFAULT_OPTIONS={classes:["hqr-app","hqr-lifecycle"],position:{width:780,height:780},window:{title:"Quest Giving & Turn-In",resizable:true},tag:"section"};
  static PARTS={main:{template:`modules/${ID}/templates/quest-lifecycle.hbs`}};
  constructor(doc,mode="giving",options={}){
    super(options);this.doc=doc;this.mode=mode;
    this.people=[];
    this.selectedParticipants=[];
    this.selectedGroups=[];
    this.rowTargets={};
  }
  async _prepareContext(){
    assertGM();
    const doc=this.doc;
    const status=doc.getFlag(ID,"status")??"unavailable";
    const all=game.actors.filter(eligible);
    const alreadyAssigned=new Set(doc.getFlag(ID,"assignees")??[]);
    const progress=doc.getFlag(ID,"progress")??{};
    const availableToGive=all.filter(a=>!alreadyAssigned.has(a.id));
    const isFailure=this.mode==="failure";
    const waiting=getQuestParticipants(doc).filter(a=>["accepted","in-progress"].includes(progressOf(doc,a.id)) ||
      (isFailure && progress[a.id]?.status==="failed" && progress[a.id]?.reason==="Quest became Inactive" && !progress[a.id]?.failurePayoutId));
    const permittedIds=new Set(waiting.map(a=>a.id));
    this.people=this.people.filter(id=>availableToGive.some(a=>a.id===id));
    this.selectedParticipants=this.selectedParticipants.filter(id=>permittedIds.has(id));
    const hasFailurePenalties=Boolean(doc.getFlag(ID,"failurePenaltiesEnabled")) &&
      (doc.getFlag(ID,"failurePenalties")??[]).length>0;
    const groups=isFailure&&!hasFailurePenalties ? [] : candidateGroups(this.selectedParticipants);
    const eligibleGroupIds=new Set(groups.map(g=>g.id));
    const groupAwards=doc.getFlag(ID,isFailure?"groupFailures":"groupAwards")??{};
    this.selectedGroups=this.selectedGroups.filter(id=>eligibleGroupIds.has(id)&&!groupAwards[id]);
    const renownSource=isFailure?(doc.getFlag(ID,"failurePenaltiesEnabled")?(doc.getFlag(ID,"failurePenalties")??[]):[]):(doc.getFlag(ID,"renownRewards")??[]);
    const renown=renownSource.map(r=>{
      const settings=this.rowTargets[r.id]??{personal:true,group:true};
      return {...r,factionName:factions().find(f=>f.uuid===r.factionUuid)?.name??"Unknown Faction",
        amountLabel:Number(r.amount)>0?`+${r.amount}`:String(r.amount),positive:Number(r.amount)>=0,
        personal:settings.personal,group:settings.group};
    });
    const curr=doc.getFlag(ID,"currency")??{};
    const items=doc.getFlag(ID,"items")??[];
    const payouts=doc.getFlag(ID,isFailure?"failurePayouts":"payouts")??[];
    const isGiving=this.mode==="giving";
    const pending=doc.getFlag(ID,isFailure?"activeFailureTurnIn":"activeTurnIn")??null;
    return {name:doc.name,status,statusLabel:status.replaceAll("-"," "),isGiving,isFailure,
      canGive:status==="available",canTurnIn:isFailure?["available","inactive"].includes(status):status==="available",
      pcs:all.map(a=>({id:a.id,name:a.name,checked:this.people.includes(a.id),already:alreadyAssigned.has(a.id),state:progressOf(doc,a.id)})),
      newCount:availableToGive.length,selectedNewCount:this.people.length,
      participants:getQuestParticipants(doc).map(a=>({id:a.id,name:a.name,checked:this.selectedParticipants.includes(a.id),
        eligible:permittedIds.has(a.id),state:progressOf(doc,a.id)})),
      waitingCount:waiting.length,selectedCount:this.selectedParticipants.length,
      groups:groups.map(g=>({id:g.id,name:g.name,checked:this.selectedGroups.includes(g.id),credited:!!groupAwards[g.id],
        people:(g.system?.members??[]).filter(m=>this.selectedParticipants.includes(m.actor?.id??m.actor)).map(m=>game.actors.get(m.actor?.id??m.actor)?.name).filter(Boolean).join(", ")})),
      renown,hasRenown:renown.length>0,hasLoot:CURRENCIES.some(k=>Number(curr[k])>0)||items.length>0,
      hasGroups:groups.length>0,selectedGroupCount:this.selectedGroups.length,
      currency:CURRENCIES.filter(k=>Number(curr[k])>0).map(k=>({key:k.toUpperCase(),amount:curr[k]})),
      items:items.map(item=>({name:item.name,quantity:item.quantity})),
      pending,hasPayouts:payouts.length>0};
  }
  _onRender(){
    const root=this.element;
    const listIds=(name)=>[...root.querySelectorAll(`[name="${name}"]:checked:not(:disabled)`)].map(x=>x.value);
    root.querySelectorAll('[name="assignees"]').forEach(el=>el.addEventListener("change",()=>{this.people=listIds("assignees");this._updateCounts();}));
    root.querySelector('[data-action="select-giving"]')?.addEventListener("click",()=>this._setChecks("assignees",true));
    root.querySelector('[data-action="clear-giving"]')?.addEventListener("click",()=>this._setChecks("assignees",false));
    root.querySelector('[data-action="select-participants"]')?.addEventListener("click",async()=>this._setParticipants(true));
    root.querySelector('[data-action="clear-participants"]')?.addEventListener("click",async()=>this._setParticipants(false));
    root.querySelectorAll('[name="participants"]').forEach(el=>el.addEventListener("change",async()=>{
      this.selectedParticipants=listIds("participants");await this._renderPreservingScroll();
    }));
    root.querySelectorAll('[name="groups"]').forEach(el=>el.addEventListener("change",()=>{this.selectedGroups=listIds("groups");this._updateCounts();}));
    root.querySelectorAll(".hqr-turnin-renown-row").forEach(row=>row.querySelectorAll('input[type="checkbox"]').forEach(el=>el.addEventListener("change",()=>{
      this.rowTargets[row.dataset.rewardId]={personal:row.querySelector('[name="targetPersonal"]')?.checked??false,
        group:row.querySelector('[name="targetGroup"]')?.checked??false};
    })));
    root.querySelector('[data-action="give"]')?.addEventListener("click",async()=>{
      try{
        const count=await giveQuest(this.doc,{assignees:this.people});
        this.people=[];ui.notifications.info(`${count} Character(s) accepted ${this.doc.name}.`);
        await this.render();
      }catch(error){report(error,"Quest Giving failed");}
    });
    root.querySelector('[data-action="issue"]')?.addEventListener("click",async()=>{
      const failure=this.mode==="failure";
      try{
        if(failure ? !["available","inactive"].includes(this.doc.getFlag(ID,"status")) : this.doc.getFlag(ID,"status")!=="available")
          throw new Error("This Quest does not permit the selected Turn-In result.");
        const locked=!!this.doc.getFlag(ID,failure?"activeFailureTurnIn":"activeTurnIn");
        if(!locked && !this.selectedParticipants.length)throw new Error("Select at least one unfinished Character.");
        const confirmed=await foundry.applications.api.DialogV2.confirm({window:{title:failure?"Confirm Failure Turn-In":"Confirm Success Turn-In"},
          content:locked
            ? `<p>Resume the interrupted ${failure?"failure":"success"} Turn-In for <strong>${esc(this.doc.name)}</strong>? Recipients and changes are frozen.</p>`
            : failure
              ? `<p>Mark <strong>${this.selectedParticipants.length} Character(s)</strong> Failed on <strong>${esc(this.doc.name)}</strong>?</p><p>Only configured Failure Penalties are applied, to the checked recipients. Normal Currency, Items and Success Renown are <strong>not</strong> granted. <strong>${this.selectedGroups.length} Group(s)</strong> selected for penalties.</p>`
              : `<p>Complete <strong>${esc(this.doc.name)}</strong> for <strong>${this.selectedParticipants.length} Character(s)</strong>?</p><p>Each selected Character receives the full Currency, Items and personal Renown. <strong>${this.selectedGroups.length} Group(s)</strong> will receive the collective Renown once. No Group is required.</p>`,
          yes:{label:failure?"Mark Failed & Apply Penalties":"Complete & Grant Each"},no:{label:"Cancel"}});
        if(!confirmed)return;
        const details={participantIds:this.selectedParticipants,groupIds:this.selectedGroups,rowTargets:this.rowTargets};
        if(failure)await failQuest(this.doc,details);else await awardQuest(this.doc,details);
        this.selectedParticipants=[];this.selectedGroups=[];
        await this.render();
      }catch(error){report(error,failure?"Failure Turn-In failed":"Success Turn-In failed");}
    });
    root.querySelector('[data-action="open"]')?.addEventListener("click",()=>this.doc.sheet?.render(true));
    this._updateCounts();
  }
  _updateCounts(){
    const setText=(selector,value)=>{const el=this.element.querySelector(selector);if(el)el.textContent=String(value);};
    setText('[data-selected="giving"]',this.people.length);
    setText('[data-selected="participants"]',this.selectedParticipants.length);
    setText('[data-selected="groups"]',this.selectedGroups.length);
    const give=this.element.querySelector('[data-action="give"]');if(give)give.disabled=!this.people.length;
    const issue=this.element.querySelector('[data-action="issue"]');
    if(issue)issue.disabled=!this.selectedParticipants.length&&!this.doc.getFlag(ID,this.mode==="failure"?"activeFailureTurnIn":"activeTurnIn");
  }
  _setChecks(name,checked){
    const inputs=[...this.element.querySelectorAll(`[name="${name}"]:not(:disabled)`)];
    for(const input of inputs)input.checked=checked;
    this.people=inputs.filter(x=>x.checked).map(x=>x.value);
    this._updateCounts();
  }
  async _setParticipants(checked){
    const inputs=[...this.element.querySelectorAll('[name="participants"]:not(:disabled)')];
    this.selectedParticipants=checked?inputs.map(x=>x.value):[];
    await this._renderPreservingScroll();
  }
  async _renderPreservingScroll(){
    const s=this.element.querySelector('.hqr-scroll')?.scrollTop??0;
    await this.render();const scroll=this.element.querySelector('.hqr-scroll');if(scroll)scroll.scrollTop=s;
  }
}
