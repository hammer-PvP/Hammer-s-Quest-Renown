import {ID,assertGM,esc,factions,rankFor} from "../constants.mjs";
import {reputationOf,historyFor,adjust} from "../services/reputation.mjs";
import {report} from "../constants.mjs";
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
export class ReputationApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS={classes:["hqr-app","hqr-reputation"],position:{width:760,height:690},window:{title:"Reputation Manager",resizable:true},tag:"section"};
  static PARTS={main:{template:`modules/${ID}/templates/reputation.hbs`}};
  constructor(actor=null,opts={}) { super(opts); this.actor=actor; }
  async _prepareContext() {
    const actors=game.actors.filter(a=>["group","character"].includes(a.type) && (game.user.isGM || a.testUserPermission(game.user,"OBSERVER")));
    if(!this.actor || !actors.includes(this.actor))this.actor=actors[0]??null;
    const facs=factions();
    const ledger=historyFor(this.actor).slice().reverse().map(x=>({
      ...x, factionName:facs.find(f=>f.uuid===x.factionUuid)?.name??"(Deleted Faction)",
      deltaLabel:x.delta>0?`+${x.delta}`:String(x.delta)
    }));
    const balances=facs.filter(f=>ledger.some(x=>x.factionUuid===f.uuid)).map(f=>({name:f.name,uuid:f.uuid,value:reputationOf(this.actor,f.uuid),rank:rankFor(f,reputationOf(this.actor,f.uuid))}));
    const partyBalances=[];
    if(this.actor?.type==='character') {
      for (const group of game.actors.filter(a=>a.type==='group')) {
        if(!group.system?.members?.some(m=>m.actor?.id===this.actor.id))continue;
        if(!game.user.isGM && !group.testUserPermission(game.user,'OBSERVER'))continue;
        for (const faction of facs) {
          if(!(group.getFlag(ID,'ledger')??[]).some(row=>row.factionUuid===faction.uuid))continue;
          const value=reputationOf(group,faction.uuid);
          partyBalances.push({name:faction.name,groupName:group.name,value,rank:rankFor(faction,value)});
        }
      }
    }
    return {gm:game.user.isGM,actors:actors.map(a=>({id:a.id,name:`${a.name} (${a.type})`,selected:a===this.actor})),factions:facs.map(f=>({uuid:f.uuid,name:f.name})),selected:this.actor?.id??"",balances,partyBalances,ledger,hasActor:!!this.actor};
  }
  _onRender(){
    const root=this.element;
    root.querySelector('[name="actorId"]')?.addEventListener("change",event=>{this.actor=game.actors.get(event.target.value);this.render();});
    root.querySelector('[data-action="apply"]')?.addEventListener("click",async()=>{
      try {
        assertGM();
        const faction=root.querySelector('[name="factionUuid"]')?.value;
        const amountText=root.querySelector('[name="amount"]')?.value?.trim();
        const reason=root.querySelector('[name="reason"]')?.value?.trim();
        if(amountText==="" || !Number.isInteger(Number(amountText)))throw new Error("Enter an integer Renown change (zero is allowed to discover a Faction).");
        await adjust(this.actor,faction,Number(amountText),reason);
        await this.render();
        ui.notifications.info("Renown adjustment recorded.");
      }catch(error){report(error,"Renown adjustment failed");}
    });
  }
}
