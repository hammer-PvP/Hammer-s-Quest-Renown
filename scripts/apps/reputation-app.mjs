import {ID,eligible,assertGM,factions,rankFor,report} from "../constants.mjs";
import {reputationOf,historyFor} from "../services/reputation.mjs";
import {applyRenownBatch,getPendingRenownBatch} from "../services/batch-reputation.mjs";

const {ApplicationV2,HandlebarsApplicationMixin} = foundry.applications.api;
const PAGE_SIZE = 20;

/** Batch-safe manual Renown management; pre-v0.0.6 Actor ledgers are read unchanged. */
export class ReputationApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {classes:["hqr-app","hqr-reputation"],position:{width:790,height:710},window:{title:"Reputation Manager",resizable:true},tag:"section"};
  static PARTS = {main:{template:`modules/${ID}/templates/reputation.hbs`}};
  constructor(actor=null,opts={}) {
    super(opts);
    this.actor=actor;
    this.selectedActorIds=new Set(actor && game.user?.isGM ? [actor.id] : []);
    this.draftAmount="0";
    this.draftReason="";
    this.draftFaction="";
    this.historyPage=0;
    this.fullHistoryOpen=false;
  }
  _saveDraft(root) {
    this.draftAmount=root.querySelector('[name="amount"]')?.value??this.draftAmount;
    this.draftReason=root.querySelector('[name="reason"]')?.value??this.draftReason;
    this.draftFaction=root.querySelector('[name="factionUuid"]')?.value??this.draftFaction;
  }
  async _prepareContext() {
    const all=game.actors.filter(a=>["group","character"].includes(a.type) && (game.user.isGM || a.testUserPermission(game.user,"OBSERVER")));
    if(!this.actor || !all.includes(this.actor))this.actor=all[0]??null;
    const characters=all.filter(eligible).sort((a,b)=>a.name.localeCompare(b.name));
    const groups=all.filter(a=>a.type==="group").sort((a,b)=>a.name.localeCompare(b.name));
    const allowed=new Set([...characters,...groups].map(a=>a.id));
    this.selectedActorIds=new Set([...this.selectedActorIds].filter(id=>allowed.has(id)));
    const facs=factions();
    const ledger=historyFor(this.actor).slice().reverse().map(x=>({
      ...x, factionName:facs.find(f=>f.uuid===x.factionUuid)?.name??"(Deleted Faction)",
      deltaLabel:Number(x.delta)>0?`+${x.delta}`:String(x.delta)
    }));
    const balances=facs.filter(f=>ledger.some(x=>x.factionUuid===f.uuid)).map(f=>({name:f.name,uuid:f.uuid,value:reputationOf(this.actor,f.uuid),rank:rankFor(f,reputationOf(this.actor,f.uuid))}));
    const pending=game.user.isGM?getPendingRenownBatch():null;
    this._inspectedLedger=ledger;
    const targetFaction=facs.some(f=>f.uuid===this.draftFaction)?this.draftFaction:facs[0]?.uuid??"";
    this.draftFaction=targetFaction;
    return {
      gm:game.user.isGM,
      characters:characters.map(a=>({id:a.id,name:a.name,checked:this.selectedActorIds.has(a.id),inspecting:a===this.actor})),
      groups:groups.map(a=>({id:a.id,name:a.name,checked:this.selectedActorIds.has(a.id),inspecting:a===this.actor})),
      characterCount:characters.length,groupCount:groups.length,
      inspectedActorName:this.actor?.name??"No Actor selected",
      factions:facs.map(f=>({uuid:f.uuid,name:f.name,selected:f.uuid===targetFaction})),
      balances,balanceCount:balances.length,
      recentHistory:ledger.slice(0,5),historyCount:ledger.length,hasMoreHistory:ledger.length>5,
      draftAmount:this.draftAmount,draftReason:this.draftReason,
      pending:!!pending,pendingCount:pending?.actorIds.length??0,
      pendingFaction:facs.find(f=>f.uuid===pending?.factionUuid)?.name??"Missing Faction",
      pendingDelta:pending?.delta??0,pendingReason:pending?.reason??""
    };
  }
  _onRender() {
    const root=this.element;
    const checkboxes=()=>[...root.querySelectorAll('input[name="recipient"]')];
    const selected=()=>checkboxes().filter(e=>e.checked).map(e=>e.value);
    const inspectButtons=root.querySelectorAll('[data-action="inspect"]');
    for (const button of inspectButtons) button.addEventListener('click',async()=>{
      this._saveDraft(root);
      this.selectedActorIds=new Set(selected());
      const target=game.actors.get(button.dataset.actorId);
      if(target){this.actor=target;this.historyPage=0;this.fullHistoryOpen=false;await this.render();}
    });

    const makeText=(tag,text,className="")=>{
      const node=document.createElement(tag);if(className)node.className=className;node.textContent=text;return node;
    };
    const preview=root.querySelector('[data-preview-list]');
    const refresh=()=>{
      this.selectedActorIds=new Set(selected());
      for(const type of ["character","group"]){
        const all=checkboxes().filter(e=>e.dataset.recipientType===type);
        const n=all.filter(e=>e.checked).length;
        const counter=root.querySelector(`[data-count="${type}"]`);
        if(counter)counter.textContent=`${n} / ${all.length}`;
      }
      if(!preview)return;
      preview.replaceChildren();
      const ids=selected();
      const counter=root.querySelector('[data-preview-count]');
      if(counter)counter.textContent=`${ids.length} Actor(s) selected`;
      const uuid=root.querySelector('[name="factionUuid"]')?.value;
      const faction=factions().find(f=>f.uuid===uuid);
      const rawAmount=root.querySelector('[name="amount"]')?.value?.trim()??"";
      const amount=rawAmount===""?NaN:Number(rawAmount);
      const reason=root.querySelector('[name="reason"]')?.value?.trim()??"";
      const valid=!!faction && Number.isSafeInteger(amount) && reason.length>0 && ids.length>0;
      const apply=root.querySelector('[data-action="apply"]');
      if(apply)apply.disabled=!valid;
      if(!ids.length){preview.append(makeText("p","Select at least one recipient.","hqr-hint"));return;}
      if(!faction || !Number.isSafeInteger(amount)){
        preview.append(makeText("p","Choose a Faction and enter a whole-number change.","hqr-hint"));return;
      }
      for(const id of ids){
        const actor=game.actors.get(id);
        if(!actor)continue;
        const before=reputationOf(actor,uuid);
        const line=makeText("div",`${actor.name} (${actor.type})` ,"hqr-preview-row");
        line.append(makeText("strong",`${before} → ${before+amount}`));
        preview.append(line);
      }
    };
    for(const checkbox of checkboxes())checkbox.addEventListener('change',refresh);
    for(const type of ["characters","groups"]){
      const suffix=type==="characters"?"character":"group";
      root.querySelector(`[data-action="select-${type}"]`)?.addEventListener('click',()=>{
        checkboxes().filter(c=>c.dataset.recipientType===suffix).forEach(c=>c.checked=true);refresh();
      });
      root.querySelector(`[data-action="clear-${type}"]`)?.addEventListener('click',()=>{
        checkboxes().filter(c=>c.dataset.recipientType===suffix).forEach(c=>c.checked=false);refresh();
      });
    }
    root.querySelector('[name="recipientSearch"]')?.addEventListener('input',event=>{
      const search=event.target.value.trim().toLocaleLowerCase();
      for(const row of root.querySelectorAll('[data-list="character"] .hqr-recipient-row'))
        row.hidden=!row.dataset.searchName?.toLocaleLowerCase().includes(search);
    });
    for(const selector of ['[name="factionUuid"]','[name="amount"]','[name="reason"]'])
      root.querySelector(selector)?.addEventListener('input',refresh);
    refresh();

    root.querySelector('[data-action="apply"]')?.addEventListener('click',async event=>{
      const button=event.currentTarget;
      try {
        assertGM();this._saveDraft(root);
        const details={actorIds:selected(),factionUuid:this.draftFaction,delta:Number(this.draftAmount),reason:this.draftReason};
        button.disabled=true;
        const outcome=await applyRenownBatch(details);
        this.selectedActorIds.clear();this.draftAmount="0";this.draftReason="";
        await this.render();
        ui.notifications.info(`Manual Renown recorded for ${outcome.recipients} Actor(s).`);
      }catch(error){report(error,"Manual Renown batch failed; resume if an operation is pending");await this.render();}
    });
    root.querySelector('[data-action="resume"]')?.addEventListener('click',async event=>{
      event.currentTarget.disabled=true;
      try {
        const outcome=await applyRenownBatch();
        this.selectedActorIds.clear();
        await this.render();
        ui.notifications.info(`Pending Renown operation completed for ${outcome.recipients} Actor(s).`);
      }catch(error){report(error,"Pending Renown batch could not be completed");await this.render();}
    });

    const full=root.querySelector('[data-full-history]');
    const drawHistory=()=>{
      if(!full)return;
      const total=this._inspectedLedger.length;
      const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
      this.historyPage=Math.max(0,Math.min(this.historyPage,pages-1));
      const list=root.querySelector('[data-history-list]');
      list.replaceChildren();
      for(const row of this._inspectedLedger.slice(this.historyPage*PAGE_SIZE,(this.historyPage+1)*PAGE_SIZE)){
        const block=makeText("div","","hqr-history");
        const span=document.createElement("span");
        span.append(makeText("strong",row.factionName),makeText("span",` ${row.deltaLabel}`,"hqr-delta"),
          makeText("small",row.reason??""),makeText("small",`${row.source??""} · ${row.at??""}`));
        block.append(span);list.append(block);
      }
      root.querySelector('[data-history-page-label]').textContent=`Page ${this.historyPage+1} / ${pages} · ${total} events`;
      root.querySelector('[data-action="history-prev"]').disabled=this.historyPage===0;
      root.querySelector('[data-action="history-next"]').disabled=this.historyPage>=pages-1;
    };
    root.querySelector('[data-action="toggle-full-history"]')?.addEventListener('click',event=>{
      full.hidden=!full.hidden;
      event.currentTarget.textContent=full.hidden?"View Full History":"Hide Full History";
      if(!full.hidden)drawHistory();
    });
    root.querySelector('[data-action="history-prev"]')?.addEventListener('click',()=>{this.historyPage--;drawHistory();});
    root.querySelector('[data-action="history-next"]')?.addEventListener('click',()=>{this.historyPage++;drawHistory();});
  }
}
