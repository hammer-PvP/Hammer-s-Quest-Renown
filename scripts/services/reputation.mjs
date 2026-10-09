import {ID,assertGM,eligible,ownerUsers,CURRENCIES,rankFor} from "../constants.mjs";
import {getFaction,reconcileAccess,getQuestParticipants} from "./documents.mjs";

export function reputationOf(actor,factionUuid) {
  return (actor?.getFlag(ID,"ledger")??[]).filter(row=>row.factionUuid===factionUuid).reduce((s,r)=>s+Number(r.delta||0),0);
}
export function historyFor(actor) { return actor?.getFlag(ID,"ledger")??[]; }
export async function adjust(actor,factionUuid,delta,reason,{source="manual",key=null,reconcile=true}={}) {
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
  if(reconcile)await reconcileAccess();
  return true;
}

/** A Group qualifies only if it contains at least one selected eligible Character. */
export function candidateGroups(participantIds=[]) {
  const ids=new Set(participantIds);
  return game.actors.filter(a=>a.type==="group" && (a.system?.members??[]).some(m=>ids.has(m.actor?.id??m.actor)));
}

/**
 * Snapshot recipients before paying. Character / Group Renown are independent ledgers.
 * Each Renown line can target the selected Characters, Groups, both, or neither.
 * Groups are NEVER inferred as reward recipients from membership alone.
 */
export async function awardQuest(doc, options={}) {
  assertGM();
  if(doc?.getFlag(ID,"kind")!=="quest") throw new Error("Not a Quest journal.");
  if(doc.getFlag(ID,"claimed")) throw new Error("This Quest has already had its rewards issued.");
  if(doc.getFlag(ID,"status")!=="completed") throw new Error("Mark the Quest Completed before issuing rewards.");

  const existingPlan=doc.getFlag(ID,"payoutPlan");
  let plan;
  if(existingPlan){
    if(!Array.isArray(existingPlan.rows))throw new Error("An obsolete or incomplete payout plan exists; GM review is required before retrying.");
    plan=existingPlan;
  } else {
    const allowed=new Set(getQuestParticipants(doc).map(a=>a.id));
    const participants=[...new Set(options.participantIds??[])];
    if(participants.some(id=>!allowed.has(id)))throw new Error("Only eligible Characters assigned this Quest may participate.");
    const eligibleGroups=new Set(candidateGroups(participants).map(group=>group.id));
    const groups=[...new Set(options.groupIds??[])];
    if(groups.some(id=>!eligibleGroups.has(id)))throw new Error("Represented Groups must contain at least one selected participant.");
    const definitions=doc.getFlag(ID,"renownRewards")??[];
    const settings=options.rowTargets??{};
    const rows=definitions.map(row=>({
      id:String(row.id), factionUuid:row.factionUuid,amount:Number(row.amount),
      personal:settings[row.id]?.personal!==false,
      group:settings[row.id]?.group!==false
    }));
    for(const row of rows){
      if(!getFaction(row.factionUuid)||!Number.isInteger(row.amount))throw new Error("Invalid Faction or Renown reward.");
      if(!row.id)throw new Error("Renown reward has no stable ID.");
      if(row.amount!==0 && ((row.personal && participants.length>0) || (row.group && groups.length>0))===false
         && (row.personal || row.group))
        throw new Error(`No recipients for ${getFaction(row.factionUuid)?.name}. Select Characters / Groups or explicitly disable both targets for this line.`);
    }
    plan={participants,groups,rows,lootRecipientId:options.lootRecipientId??"",
      createdAt:new Date().toISOString(),gmUserId:game.user.id};
  }

  const currencies=doc.getFlag(ID,"currency")??{};
  const items=doc.getFlag(ID,"items")??[];
  const hasLoot=CURRENCIES.some(k=>Number(currencies[k])>0)||items.length>0;
  const recipient=game.actors.get(plan.lootRecipientId);
  if(hasLoot && (!recipient || !["character","group"].includes(recipient.type)))
    throw new Error("Choose a Character or Group inventory destination for Currency and Items.");

  // Resolve every reward before mutating a document.
  const resolved=[];
  for(const reward of items){
    const source=await fromUuid(reward.uuid);
    if(!source || source.documentName!=="Item")throw new Error(`Reward Item missing: ${reward.name??reward.uuid}`);
    resolved.push(source);
  }
  if(!existingPlan)await doc.setFlag(ID,"payoutPlan",plan);

  // Every Actor receives at most one change per Quest + reward line.
  for(const row of plan.rows){
    if(!row.amount)continue;
    if(row.personal){
      for(const id of plan.participants){
        const actor=game.actors.get(id);
        if(!actor || actor.type!=="character")throw new Error(`Character unavailable: ${id}`);
        await adjust(actor,row.factionUuid,row.amount,`Quest completed: ${doc.name}`,
          {source:doc.uuid,key:`quest:${doc.uuid}:renown:${row.id}:${actor.id}`,reconcile:false});
      }
    }
    if(row.group){
      for(const id of plan.groups){
        const actor=game.actors.get(id);
        if(!actor || actor.type!=="group")throw new Error(`Group unavailable: ${id}`);
        await adjust(actor,row.factionUuid,row.amount,`Quest completed: ${doc.name}`,
          {source:doc.uuid,key:`quest:${doc.uuid}:renown:${row.id}:${actor.id}`,reconcile:false});
      }
    }
  }
  if(hasLoot){
    const key=`quest:${doc.uuid}:currency`;
    const paid=recipient.getFlag(ID,"paidCurrency")??[];
    if(!paid.includes(key)){
      const updates={[`flags.${ID}.paidCurrency`]:[...paid,key]};
      for(const denomination of CURRENCIES){
        const amount=Math.max(0,Math.trunc(Number(currencies[denomination])||0));
        if(amount)updates[`system.currency.${denomination}`]=Number(recipient.system?.currency?.[denomination]??0)+amount;
      }
      await recipient.update(updates);
    }
    for(let i=0;i<items.length;i++){
      const key=`quest:${doc.uuid}:item:${i}`;
      if(recipient.items.some(x=>x.getFlag(ID,"rewardKey")===key))continue;
      const data=resolved[i].toObject();delete data._id;
      data.system??={};data.system.quantity=Math.max(1,Math.trunc(Number(items[i].quantity)||1));
      data.flags??={};data.flags[ID]={...(data.flags[ID]??{}),rewardKey:key};
      await recipient.createEmbeddedDocuments("Item",[data]);
    }
  }
  await doc.setFlag(ID,"claimed",true);
  await doc.setFlag(ID,"completedAt",new Date().toISOString());
  await reconcileAccess();
  ui.notifications.info(`Rewards issued for ${doc.name}.`);
  return true;
}
