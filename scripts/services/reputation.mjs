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
  if(doc.getFlag(ID,"activeFailureTurnIn"))throw new Error("Resume the pending Failure Turn-In before completing a Quest.");
  if(doc.getFlag(ID,"activeFailureReversal")||doc.getFlag(ID,'activeSuccessReversal'))throw new Error("Resume the pending Quest correction first.");
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
    const defaultCurrency=doc.getFlag(ID,'currency')??{};
    const defaultItems=doc.getFlag(ID,'items')??[];
    const overrides=options.individualOverrides??{};
    const perActor={};
    for(const id of participants){
      const override=overrides[id]??{};
      const currency=Object.fromEntries(CURRENCIES.map(k=>{
        const amount=Number(override.currency?.[k]??defaultCurrency[k]??0);
        if(!Number.isSafeInteger(amount)||amount<0)throw new Error(`Invalid ${k} reward override.`);
        return [k,amount];
      }));
      const itemQuantities=defaultItems.map((item,index)=>{
        const amount=Number(override.items?.[index]??item.quantity??1);
        if(!Number.isSafeInteger(amount)||amount<0)throw new Error('Individual Item quantities must be non-negative whole numbers.');
        return amount;
      });
      const renown=Object.fromEntries(rows.map(row=>{
        const amount=Number(override.renown?.[row.id]??row.amount);
        if(!Number.isSafeInteger(amount))throw new Error('Individual Renown overrides must be whole numbers.');
        return [row.id,amount];
      }));
      perActor[id]={currency,itemQuantities,renown};
    }
    plan={id:foundry.utils.randomID(),keyVersion:2,participants,groups,rows,perActor,
      currency:defaultCurrency,items:defaultItems,createdAt:new Date().toISOString(),gmUserId:game.user.id};
    await doc.setFlag(ID,"activeTurnIn",plan); // Save before touching Actors.
  }
  // Resolve Items before mutating any inventories. Changes to the Quest are locked after the first payout.
  const items=plan.items??doc.getFlag(ID,"items")??[];
  const resolved=[];
  for(const item of items){
    const source=await fromUuid(item.uuid);
    if(!source||source.documentName!=="Item")throw new Error(`Reward Item missing: ${item.name??item.uuid}`);
    resolved.push(source);
  }
  const currency=plan.currency??doc.getFlag(ID,"currency")??{};
  const version2=Number(plan.keyVersion)>=2;
  for(const id of plan.participants){
    const actor=game.actors.get(id);
    if(!eligible(actor))throw new Error(`Participant Actor unavailable: ${id}`);
    const custom=plan.perActor?.[id];
    for(const row of plan.rows){
      const amount=version2?Number(custom?.renown?.[row.id]??row.amount):row.amount;
      if(row.personal && amount)await adjust(actor,row.factionUuid,amount,`Quest completed: ${doc.name}`,
        {source:doc.uuid,key:version2?`quest:${doc.uuid}:renown:${plan.id}:${row.id}:${actor.id}`:`quest:${doc.uuid}:renown:${row.id}:${actor.id}`,reconcile:false});
    }
    const paidCurrency=actor.getFlag(ID,"paidCurrency")??[];
    const currencyKey=version2?`quest:${doc.uuid}:currency:${plan.id}:${actor.id}`:`quest:${doc.uuid}:currency:${actor.id}`;
    if(!paidCurrency.includes(currencyKey)){
      const changes={[`flags.${ID}.paidCurrency`]:[...paidCurrency,currencyKey]};
      for(const denomination of CURRENCIES){
        const amount=version2?Number(custom?.currency?.[denomination]??currency[denomination]??0)
          :Math.max(0,Math.trunc(Number(currency[denomination])||0));
        if(amount)changes[`system.currency.${denomination}`]=Number(actor.system?.currency?.[denomination]??0)+amount;
      }
      await actor.update(changes);
    }
    for(let i=0;i<items.length;i++){
      const quantity=version2?Number(custom?.itemQuantities?.[i]??items[i].quantity):Math.max(1,Math.trunc(Number(items[i].quantity)||1));
      if(quantity===0)continue;
      const key=version2?`quest:${doc.uuid}:item:${plan.id}:${i}:${actor.id}`:`quest:${doc.uuid}:item:${i}:${actor.id}`;
      if(actor.items.some(x=>x.getFlag(ID,"rewardKey")===key))continue;
      const data=resolved[i].toObject();delete data._id;
      data.system??={};data.system.quantity=quantity;
      data.flags??={};data.flags[ID]={...(data.flags[ID]??{}),rewardKey:key};
      await actor.createEmbeddedDocuments("Item",[data]);
    }
  }
  for(const id of plan.groups){
    const group=game.actors.get(id);
    if(group?.type!=="group")throw new Error(`Represented Group missing: ${id}`);
    for(const row of plan.rows){
      if(row.group && row.amount)await adjust(group,row.factionUuid,row.amount,`Quest completed: ${doc.name}`,
        {source:doc.uuid,key:version2?`quest:${doc.uuid}:renown:${plan.id}:${row.id}:${group.id}`:`quest:${doc.uuid}:renown:${row.id}:${group.id}`,reconcile:false});
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
    [`flags.${ID}.payouts`]:payouts,[`flags.${ID}.activeTurnIn`]:new foundry.data.operators.ForcedDeletion()});
  await reconcileAccess();
  ui.notifications.info(`Quest rewards delivered to ${plan.participants.length} Character(s): ${doc.name}.`);
  return true;
}

/** GM-authorized Failure Turn-In. A failure does not grant Success Currency/Items/Renown.
 * Retains any v0.0.6 legacy auto-Failed result; an explicitly confirmed Fail Turn-In
 * may formalize that pre-existing automatic failure without rewriting earlier history.
 */
export async function failQuest(doc, options={}) {
  assertGM();
  if(doc?.getFlag(ID,"kind")!=="quest")throw new Error("Not a Quest journal.");
  if(!["available","inactive"].includes(doc.getFlag(ID,"status")))
    throw new Error("Only Available or Inactive Quests can record a Failure Turn-In.");
  if(doc.getFlag(ID,"activeTurnIn"))throw new Error("Resume the pending Success Turn-In first.");
  if(doc.getFlag(ID,"activeFailureReversal")||doc.getFlag(ID,'activeSuccessReversal'))throw new Error("Resume the pending Quest correction first.");
  let plan=doc.getFlag(ID,"activeFailureTurnIn");
  if(!plan){
    const progress=doc.getFlag(ID,"progress")??{};
    const allowed=new Set(getQuestParticipants(doc).map(a=>a.id));
    const participants=[...new Set(options.participantIds??[])];
    if(!participants.length)throw new Error("Select at least one Character to fail the Quest.");
    if(participants.some(id=>!allowed.has(id) || !(["accepted","in-progress"].includes(progress[id]?.status) ||
      (progress[id]?.status==="failed" && progress[id]?.reason==="Quest became Inactive" && !progress[id]?.failurePayoutId))))
      throw new Error("Only unfinished Characters (or legacy auto-Failed Characters) can be marked Failed.");
    const candidates=new Set(candidateGroups(participants).map(g=>g.id));
    const groups=[...new Set(options.groupIds??[])];
    const previous=doc.getFlag(ID,"groupFailures")??{};
    if(groups.some(id=>!candidates.has(id)||previous[id]))
      throw new Error("A selected Group is ineligible or already penalized for this Quest.");
    const settings=options.rowTargets??{};
    const enabled=Boolean(doc.getFlag(ID,"failurePenaltiesEnabled"));
    const rows=(enabled?(doc.getFlag(ID,"failurePenalties")??[]):[]).map(r=>({
      id:String(r.id),factionUuid:r.factionUuid,amount:Number(r.amount),
      personal:settings[r.id]?.personal!==false,group:settings[r.id]?.group!==false
    }));
    for(const row of rows){
      if(!row.id||!getFaction(row.factionUuid)||!Number.isSafeInteger(row.amount)||row.amount>=0)
        throw new Error("Invalid configured Failure Penalty. No status was changed.");
    }
    if(groups.length&&!rows.some(r=>r.group))
      throw new Error("No Group Failure Penalty is enabled. Uncheck Groups for a no-penalty failure.");
    const materialEnabled=enabled&&options.applyMaterialPenalties!==false;
    const failureCurrency=materialEnabled?(doc.getFlag(ID,'failureCurrency')??{}):{};
    const failureItems=materialEnabled?(doc.getFlag(ID,'failureItems')??[]):[];
    const forfeitures={};
    for(const id of participants){
      const actor=game.actors.get(id);const confiscations=[];
      for(const k of CURRENCIES){
        const amount=Math.trunc(Number(failureCurrency[k])||0);
        if(!Number.isSafeInteger(amount)||amount<0||Number(actor.system?.currency?.[k]??0)<amount)
          throw new Error(`${actor.name} does not have enough ${k.toUpperCase()} for the Failure Penalty.`);
      }
      const requiredByStack=new Map();
      for(const item of failureItems){
        const source=await fromUuid(item.uuid);
        if(source?.documentName!=='Item')throw new Error(`Missing Failure Item: ${item.name??item.uuid}`);
        const matches=actor.items.filter(i=>i.type===source.type&&i.name===source.name);
        if(matches.length!==1)throw new Error(`${actor.name} must have exactly one matching Item stack: ${source.name}.`);
        const target=matches[0],amount=Math.trunc(Number(item.quantity)||1);
        if(!Number.isSafeInteger(amount)||amount<1||Number(target.system?.quantity??0)<amount)
          throw new Error(`${actor.name} does not have enough ${source.name}.`);
        requiredByStack.set(target.id,(requiredByStack.get(target.id)??0)+amount);
        if(requiredByStack.get(target.id)>Number(target.system?.quantity??0))
          throw new Error(`${actor.name} does not have enough ${source.name} for the combined Failure Penalty.`);
        confiscations.push({itemId:target.id,amount,name:target.name,sourceUuid:item.uuid});
      }
      forfeitures[id]={currency:Object.fromEntries(CURRENCIES.map(k=>[k,Math.trunc(Number(failureCurrency[k])||0)])),items:confiscations};
    }
    plan={id:foundry.utils.randomID(),keyVersion:2,participants,groups,rows,forfeitures,
      createdAt:new Date().toISOString(),gmUserId:game.user.id};
    await doc.setFlag(ID,"activeFailureTurnIn",plan);
  }
  // Snapshot is frozen before the first Actor write. Each ledger key survives F5/retry.
  for(const id of plan.participants){
    const actor=game.actors.get(id);
    if(!actor || actor.type!=="character")throw new Error(`Missing failed Character ${id}`);
    for(const row of plan.rows){
      if(row.personal)await adjust(actor,row.factionUuid,row.amount,`Quest failed: ${doc.name}`,
        {source:doc.uuid,key:Number(plan.keyVersion)>=2?`quest:${doc.uuid}:failure:${plan.id}:${row.id}:${actor.id}`:`quest:${doc.uuid}:failure:${row.id}:${actor.id}`,reconcile:false});
    }
    const forfeiture=plan.forfeitures?.[id];
    if(forfeiture){
      const currencyKey=`quest:${doc.uuid}:failure:${plan.id}:currency:${id}`;
      const debited=actor.getFlag(ID,'failureDebitedCurrency')??[];
      if(!debited.includes(currencyKey)){
        const changes={[`flags.${ID}.failureDebitedCurrency`]:[...debited,currencyKey]};
        for(const k of CURRENCIES){
          const amount=Number(forfeiture.currency?.[k]??0);
          if(Number(actor.system?.currency?.[k]??0)<amount)throw new Error(`${actor.name} cannot pay the ${k.toUpperCase()} Failure Penalty.`);
          if(amount)changes[`system.currency.${k}`]=Number(actor.system.currency[k])-amount;
        }
        await actor.update(changes);
      }
      for(const [index,forfeit] of (forfeiture.items??[]).entries()){
        const item=actor.items.get(forfeit.itemId);
        if(!item)throw new Error(`The confiscated Item ${forfeit.name} is missing from ${actor.name}.`);
        const key=`quest:${doc.uuid}:failure:${plan.id}:item:${id}:${index}`;
        const deducted=item.getFlag(ID,'failureDebitKeys')??[];
        if(deducted.includes(key))continue;
        if(Number(item.system?.quantity??0)<forfeit.amount)throw new Error(`Not enough ${forfeit.name} remaining on ${actor.name}.`);
        await item.update({'system.quantity':Number(item.system.quantity)-forfeit.amount,
          [`flags.${ID}.failureDebitKeys`]:[...deducted,key]});
      }
    }
  }
  for(const id of plan.groups){
    const group=game.actors.get(id);
    if(group?.type!=="group")throw new Error(`Missing represented Group ${id}`);
    for(const row of plan.rows){
      if(row.group)await adjust(group,row.factionUuid,row.amount,`Quest failed: ${doc.name}`,
        {source:doc.uuid,key:Number(plan.keyVersion)>=2?`quest:${doc.uuid}:failure:${plan.id}:${row.id}:${group.id}`:`quest:${doc.uuid}:failure:${row.id}:${group.id}`,reconcile:false});
    }
  }
  const at=new Date().toISOString();
  const progress={...(doc.getFlag(ID,"progress")??{})};
  for(const id of plan.participants){
    const former=progress[id]??{};
    progress[id]={...former,status:"failed",failedAt:at,failurePayoutId:plan.id,
      reason:"Quest Failure Turn-In",previousStatus:["accepted","in-progress"].includes(former.status)?former.status:"accepted",...(former.reason==="Quest became Inactive"?{legacyAutoFailedAt:former.failedAt}: {})};
  }
  const groupFailures={...(doc.getFlag(ID,"groupFailures")??{})};
  for(const id of plan.groups)groupFailures[id]={payoutId:plan.id,at};
  const failurePayouts=[...(doc.getFlag(ID,"failurePayouts")??[]),{...plan,failedAt:at}];
  await doc.update({[`flags.${ID}.progress`]:progress,[`flags.${ID}.groupFailures`]:groupFailures,
    [`flags.${ID}.failurePayouts`]:failurePayouts,[`flags.${ID}.activeFailureTurnIn`]:new foundry.data.operators.ForcedDeletion()});
  await reconcileAccess();
  ui.notifications.info(`Quest failure recorded for ${plan.participants.length} Character(s): ${doc.name}.`);
  return true;
}
