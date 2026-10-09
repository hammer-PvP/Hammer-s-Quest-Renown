import {ID,assertGM,eligible,CURRENCIES} from "../constants.mjs";
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
  const row={id:foundry.utils.randomID(),key:key??foundry.utils.randomID(),factionUuid,
    delta:Number(delta),reason:String(reason).trim(),source,at:new Date().toISOString(),gmUserId:game.user.id};
  await actor.setFlag(ID,"ledger",[...rows,row]);
  if(reconcile)await reconcileAccess();
  return true;
}

export function candidateGroups(participantIds=[]) {
  const ids=new Set(participantIds);
  return game.actors.filter(a=>a.type==="group" && (a.system?.members??[]).some(m=>ids.has(m.actor?.id??m.actor)));
}

/** Each = the full Currency/Item/Renown award to each newly completing Character.
 * Group awards are optional, separate, and limited to one Turn-In per Quest/Group.
 * A saved pending turn-in snapshot is retried unchanged after a partial failure.
 */
export async function awardQuest(doc,options={}) {
  assertGM();
  if(doc?.getFlag(ID,"kind")!=="quest")throw new Error("Not a Quest journal.");
  if(doc.getFlag(ID,"status")!=="available")throw new Error("Quest must be Available for Turn-In.");
  const pending=doc.getFlag(ID,"activeTurnIn");
  let plan=pending;
  if(!plan){
    const progress=doc.getFlag(ID,"progress")??{};
    const allowed=new Set(getQuestParticipants(doc).map(a=>a.id));
    const participants=[...new Set(options.participantIds??[])];
    if(!participants.length)throw new Error("Select at least one Character to complete the Quest.");
    if(participants.some(id=>!allowed.has(id)||!["accepted","in-progress"].includes(progress[id]?.status)))
      throw new Error("One or more Characters are not eligible or have already completed/failed this Quest.");
    const candidates=new Set(candidateGroups(participants).map(g=>g.id));
    const groups=[...new Set(options.groupIds??[])];
    const priorGroups=doc.getFlag(ID,"groupAwards")??{};
    if(groups.some(id=>!candidates.has(id)||priorGroups[id]))
      throw new Error("A selected Group is ineligible or already credited for this Quest.");
    const settings=options.rowTargets??{};
    const rows=(doc.getFlag(ID,"renownRewards")??[]).map(r=>({
      id:String(r.id),factionUuid:r.factionUuid,amount:Number(r.amount),
      personal:settings[r.id]?.personal!==false, group:settings[r.id]?.group!==false
    }));
    for(const row of rows){
      if(!row.id||!getFaction(row.factionUuid)||!Number.isInteger(row.amount))throw new Error("Invalid Renown reward.");
    }
    if(groups.length && !rows.some(row=>row.group && row.amount!==0))
      throw new Error("Groups were selected, but no Group Renown reward is enabled. Uncheck the Groups or enable a Group reward.");
    plan={id:foundry.utils.randomID(),participants,groups,rows,createdAt:new Date().toISOString(),gmUserId:game.user.id};
    await doc.setFlag(ID,"activeTurnIn",plan); // Save before touching Actors.
  }
  // Resolve Items before mutating any inventories. Changes to the Quest are locked after the first payout.
  const items=doc.getFlag(ID,"items")??[];
  const resolved=[];
  for(const item of items){
    const source=await fromUuid(item.uuid);
    if(!source||source.documentName!=="Item")throw new Error(`Reward Item missing: ${item.name??item.uuid}`);
    resolved.push(source);
  }
  const currency=doc.getFlag(ID,"currency")??{};
  for(const id of plan.participants){
    const actor=game.actors.get(id);
    if(!eligible(actor))throw new Error(`Participant Actor unavailable: ${id}`);
    for(const row of plan.rows){
      if(row.personal && row.amount)await adjust(actor,row.factionUuid,row.amount,`Quest completed: ${doc.name}`,
        {source:doc.uuid,key:`quest:${doc.uuid}:renown:${row.id}:${actor.id}`,reconcile:false});
    }
    const paidCurrency=actor.getFlag(ID,"paidCurrency")??[];
    const currencyKey=`quest:${doc.uuid}:currency:${actor.id}`;
    if(!paidCurrency.includes(currencyKey)){
      const changes={[`flags.${ID}.paidCurrency`]:[...paidCurrency,currencyKey]};
      for(const denomination of CURRENCIES){
        const amount=Math.max(0,Math.trunc(Number(currency[denomination])||0));
        if(amount)changes[`system.currency.${denomination}`]=Number(actor.system?.currency?.[denomination]??0)+amount;
      }
      await actor.update(changes);
    }
    for(let i=0;i<items.length;i++){
      const key=`quest:${doc.uuid}:item:${i}:${actor.id}`;
      if(actor.items.some(x=>x.getFlag(ID,"rewardKey")===key))continue;
      const data=resolved[i].toObject();delete data._id;
      data.system??={};data.system.quantity=Math.max(1,Math.trunc(Number(items[i].quantity)||1));
      data.flags??={};data.flags[ID]={...(data.flags[ID]??{}),rewardKey:key};
      await actor.createEmbeddedDocuments("Item",[data]);
    }
  }
  for(const id of plan.groups){
    const group=game.actors.get(id);
    if(group?.type!=="group")throw new Error(`Represented Group missing: ${id}`);
    for(const row of plan.rows){
      if(row.group && row.amount)await adjust(group,row.factionUuid,row.amount,`Quest completed: ${doc.name}`,
        {source:doc.uuid,key:`quest:${doc.uuid}:renown:${row.id}:${group.id}`,reconcile:false});
    }
  }
  // Commit outcomes only after all rewards were delivered; retry is idempotent.
  const at=new Date().toISOString();
  const progress={...(doc.getFlag(ID,"progress")??{})};
  for(const id of plan.participants)progress[id]={...(progress[id]??{}),status:"completed",completedAt:at,payoutId:plan.id};
  const groupAwards={...(doc.getFlag(ID,"groupAwards")??{})};
  for(const id of plan.groups)groupAwards[id]={payoutId:plan.id,at};
  const payouts=[...(doc.getFlag(ID,"payouts")??[]),{...plan,completedAt:at}];
  await doc.update({[`flags.${ID}.progress`]:progress,[`flags.${ID}.groupAwards`]:groupAwards,
    [`flags.${ID}.payouts`]:payouts,[`flags.${ID}.-=activeTurnIn`]:null});
  await reconcileAccess();
  ui.notifications.info(`Quest rewards delivered to ${plan.participants.length} Character(s): ${doc.name}.`);
  return true;
}
