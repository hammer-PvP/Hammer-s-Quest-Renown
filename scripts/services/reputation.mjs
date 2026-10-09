import {ID,assertGM,eligible,groupMembers,ownerUsers,CURRENCIES,rankFor} from "../constants.mjs";
import {getFaction,reconcileAccess,getQuestParticipants} from "./documents.mjs";

export function reputationOf(actor,factionUuid) {
  return (actor?.getFlag(ID,"ledger")??[]).filter(row=>row.factionUuid===factionUuid).reduce((s,r)=>s+Number(r.delta||0),0);
}
export function historyFor(actor) { return actor?.getFlag(ID,"ledger")??[]; }
export async function adjust(actor,factionUuid,delta,reason,{source="manual",key=null}={}) {
  assertGM();
  if (!actor || !["group","character"].includes(actor.type)) throw new Error("Choose a Character or Group Actor.");
  if (!getFaction(factionUuid)) throw new Error("Choose an existing Faction.");
  if(!Number.isInteger(Number(delta))) throw new Error("Renown must be an integer.");
  if(!String(reason??"").trim()) throw new Error("A reason is required.");
  const rows=historyFor(actor);
  if(key && rows.some(row=>row.key===key)) return false;
  const row={ id:foundry.utils.randomID(), key:key??foundry.utils.randomID(),factionUuid,
    delta:Number(delta),reason:String(reason).trim(),source,at:new Date().toISOString(), gmUserId:game.user.id };
  await actor.setFlag(ID,"ledger",[...rows,row]);
  await reconcileAccess();
  return true;
}
/** Distribute rewards only during Turn-In; destination choices do not belong to a quest definition. */
export async function awardQuest(doc, options={}) {
  assertGM();
  if(doc?.getFlag(ID,"kind")!=="quest") throw new Error("Not a Quest journal.");
  if(doc.getFlag(ID,"claimed")) throw new Error("This Quest has already had its rewards issued.");
  if(doc.getFlag(ID,"status")!=="completed") throw new Error("Mark the Quest Completed before issuing rewards.");
  const renown=Number(doc.getFlag(ID,"renown")??0);
  const factionUuid=doc.getFlag(ID,"factionUuid");
  const currencies=doc.getFlag(ID,"currency")??{};
  const items=doc.getFlag(ID,"items")??[];
  const hasLoot=CURRENCIES.some(k=>Number(currencies[k])>0)||items.length>0;
  const participants=getQuestParticipants(doc);
  // Persist the chosen destination BEFORE transferring anything, so retries can't redirect payouts.
  const existingPlan=doc.getFlag(ID,"payoutPlan");
  const plan=existingPlan??{
    scope:options.scope??"group",
    renownActorIds:(options.scope==="individual"?(options.participantIds??[]):[doc.getFlag(ID,"groupId")]).filter(Boolean),
    lootRecipientId:options.lootRecipientId??""
  };
  if(!["individual","group"].includes(plan.scope)) throw new Error("Choose a Renown distribution mode.");
  let renownActors=[];
  if(renown){
    if(!getFaction(factionUuid)) throw new Error("Renown requires a valid Faction.");
    if(plan.scope==="group"){
      const actor=game.actors.get(plan.renownActorIds[0]);
      if(actor?.type!=="group" || actor.id!==doc.getFlag(ID,"groupId")) throw new Error("This Quest must be assigned to a Group for shared Renown.");
      renownActors=[actor];
    } else {
      if(!plan.renownActorIds.length) throw new Error("Choose participating Characters.");
      const valid=new Set(participants.map(a=>a.id));
      if(plan.renownActorIds.some(id=>!valid.has(id))) throw new Error("Renown recipient must be an eligible Quest participant.");
      renownActors=[...new Set(plan.renownActorIds)].map(id=>game.actors.get(id));
    }
  }
  const recipient=game.actors.get(plan.lootRecipientId);
  if(hasLoot && (!recipient || !["character","group"].includes(recipient.type))) throw new Error("Choose an inventory destination for currency and Items.");
  // Resolve Items before starting Actor mutations.
  const resolved=[];
  for(const reward of items){
    const source=await fromUuid(reward.uuid);
    if(!source || source.documentName!=="Item") throw new Error(`Reward Item missing: ${reward.name??reward.uuid}`);
    resolved.push(source);
  }
  if(!existingPlan) await doc.setFlag(ID,"payoutPlan",plan);
  for(const actor of renownActors){
    await adjust(actor,factionUuid,renown,`Quest completed: ${doc.name}`,{source:doc.uuid,key:`quest:${doc.uuid}:renown:${actor.id}`});
  }
  if(hasLoot){
    const key=`quest:${doc.uuid}:currency`;
    const paid=recipient.getFlag(ID,"paidCurrency")??[];
    if(!paid.includes(key)){
      const updates={[`flags.${ID}.paidCurrency`]:[...paid,key]};
      for(const denomination of CURRENCIES){
        const amount=Math.max(0,Math.trunc(Number(currencies[denomination])||0));
        if(amount) updates[`system.currency.${denomination}`]=Number(recipient.system?.currency?.[denomination]??0)+amount;
      }
      await recipient.update(updates);
    }
    for(let i=0;i<items.length;i++){
      const key=`quest:${doc.uuid}:item:${i}`;
      if(recipient.items.some(x=>x.getFlag(ID,"rewardKey")===key)) continue;
      const data=resolved[i].toObject();
      delete data._id;
      data.system??={};
      data.system.quantity=Math.max(1,Math.trunc(Number(items[i].quantity)||1));
      data.flags??={};
      data.flags[ID]={...(data.flags[ID]??{}),rewardKey:key};
      await recipient.createEmbeddedDocuments("Item",[data]);
    }
  }
  await doc.setFlag(ID,"claimed",true);
  ui.notifications.info(`Rewards issued for ${doc.name}.`);
  return true;
}
