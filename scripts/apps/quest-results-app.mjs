import {ID,assertGM,factions,CURRENCIES} from '../constants.mjs';
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
/** GM-only read-only record. Never triggers reward services. */
export class QuestResultsApp extends HandlebarsApplicationMixin(ApplicationV2){
  static DEFAULT_OPTIONS={classes:['hqr-app','hqr-results'],position:{width:700,height:610},window:{title:'Quest Results',resizable:true},tag:'section'};
  static PARTS={main:{template:`modules/${ID}/templates/quest-results.hbs`}};
  constructor(doc,opts={}){super(opts);this.doc=doc;}
  async _prepareContext(){
    assertGM();
    const doc=this.doc;
    const plan=doc.getFlag(ID,'payoutPlan');
    const rowResults=(plan?.rows??[]).map(row=>({
      faction:factions().find(f=>f.uuid===row.factionUuid)?.name??'Deleted Faction',
      amount:Number(row.amount)>0?`+${row.amount}`:String(row.amount),
      personal:row.personal,group:row.group
    }));
    const currency=doc.getFlag(ID,'currency')??{};
    return {name:doc.name,status:doc.getFlag(ID,'status'),claimed:!!doc.getFlag(ID,'claimed'),
      completedAt:doc.getFlag(ID,'completedAt')??'',hasPlan:!!plan,
      participants:(plan?.participants??[]).map(id=>game.actors.get(id)?.name??`Missing Character (${id})`),
      groups:(plan?.groups??[]).map(id=>game.actors.get(id)?.name??`Missing Group (${id})`),
      rows:rowResults,lootRecipient:game.actors.get(plan?.lootRecipientId)?.name??'None',
      currency:CURRENCIES.filter(k=>Number(currency[k])>0).map(k=>({name:k.toUpperCase(),amount:currency[k]})),
      items:(doc.getFlag(ID,'items')??[]).map(item=>({name:item.name,quantity:item.quantity}))};
  }
  _onRender(){this.element.querySelector('[data-action="open"]')?.addEventListener('click',()=>this.doc.sheet?.render(true));}
}
