import {ID,assertGM,factions,CURRENCIES} from "../constants.mjs";
import {FailureReversalApp} from "./failure-reversal-app.mjs";
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
export class QuestResultsApp extends HandlebarsApplicationMixin(ApplicationV2){
  static DEFAULT_OPTIONS={classes:["hqr-app","hqr-results"],position:{width:700,height:610},window:{title:"Quest Results",resizable:true},tag:"section"};
  static PARTS={main:{template:`modules/${ID}/templates/quest-results.hbs`}};
  constructor(doc,options={}){super(options);this.doc=doc;}
  async _prepareContext(){
    assertGM();
    const doc=this.doc;
    const progress=doc.getFlag(ID,"progress")??{};
    const payouts=doc.getFlag(ID,"payouts")??[];
    const failures=doc.getFlag(ID,"failurePayouts")??[];
    const reversals=doc.getFlag(ID,"failureReversals")??[];
    const rows=(doc.getFlag(ID,"assignees")??[]).map(id=>({name:game.actors.get(id)?.name??`Missing Actor (${id})`,
      status:progress[id]?.status??"accepted",at:progress[id]?.completedAt??progress[id]?.failedAt??""}));
    const resultRows=payouts.map((run,index)=>({index:index+1,at:run.completedAt,
      participants:run.participants.map(id=>game.actors.get(id)?.name??id).join(", "),
      groups:run.groups.map(id=>game.actors.get(id)?.name??id).join(", ")||"None",
      renown:(run.rows??[]).map(r=>({faction:factions().find(f=>f.uuid===r.factionUuid)?.name??"Deleted Faction",
        amount:r.amount>0?`+${r.amount}`:String(r.amount),personal:r.personal,group:r.group}))}));
    const failureRows=failures.map((run,index)=>({index:index+1,at:run.failedAt,
      participants:(run.participants??[]).map(id=>game.actors.get(id)?.name??id).join(", "),
      groups:(run.groups??[]).map(id=>game.actors.get(id)?.name??id).join(", ")||"None",
      renown:(run.rows??[]).map(r=>({faction:factions().find(f=>f.uuid===r.factionUuid)?.name??"Deleted Faction",
        amount:String(r.amount),personal:r.personal,group:r.group}))}));
    const reversalRows=reversals.map(run=>({at:run.at,reason:run.reason,
      characters:(run.characterIds??[]).map(id=>game.actors.get(id)?.name??id).join(", ")||"None",
      groups:(run.groupIds??[]).map(id=>game.actors.get(id)?.name??id).join(", ")||"None",
      penalties:run.compensatedPenalties??0}));
    const canUndo=Object.values(progress).some(row=>row.status==="failed")||!!doc.getFlag(ID,"activeFailureReversal");
    const currency=doc.getFlag(ID,"currency")??{};
    return {name:doc.name,status:doc.getFlag(ID,"status"),rows,resultRows,failureRows,reversalRows,canUndo,
      currency:CURRENCIES.filter(k=>Number(currency[k])>0).map(k=>({name:k.toUpperCase(),amount:currency[k]})),
      items:(doc.getFlag(ID,"items")??[]).map(item=>({name:item.name,quantity:item.quantity}))};
  }
  _onRender(){this.element.querySelector('[data-action="open"]')?.addEventListener('click',()=>this.doc.sheet?.render(true));
    this.element.querySelector('[data-action="undo-failure"]')?.addEventListener('click',()=>new FailureReversalApp(this.doc).render(true));}
}
