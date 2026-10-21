import {ID,assertGM} from "../constants.mjs";

/**
 * Never delete the authoritative Quest Journal after rewards, penalties, reversals,
 * historical outcomes or pending transactions. Actor ledgers / inventories store
 * durable keys containing its UUID, so removing a paid Quest would break audit.
 * An assigned but entirely unresolved Quest may be deleted after GM confirmation;
 * its recipients are stored only on the deleted Journal.
 */
export function questDeletionStatus(doc){
  if(doc?.getFlag?.(ID,"kind")!=="quest")return {allowed:false,reason:"This is not a managed Quest."};
  for(const [flag,reason] of [
    ["activeTurnIn","A Success Turn-In is pending."],
    ["activeFailureTurnIn","A Failure Turn-In is pending."],
    ["activeFailureReversal","An Undo Failure is pending."],
    ["payouts","Success Turn-In results have been recorded."],
    ["failurePayouts","Failure Turn-In results have been recorded."],
    ["failureReversals","Undo Failure history has been recorded."]
  ]){
    const value=doc.getFlag(ID,flag);
    if(Array.isArray(value)?value.length>0:!!value)return {allowed:false,reason};
  }
  for(const flag of ["groupAwards","groupFailures"]){
    if(Object.keys(doc.getFlag(ID,flag)??{}).length)
      return {allowed:false,reason:"Group results have been recorded."};
  }
  const progress=doc.getFlag(ID,"progress")??{};
  if(Object.values(progress).some(row=>["completed","failed","abandoned"].includes(row?.status)))
    return {allowed:false,reason:"A Character has a recorded final outcome."};
  const prefix=`quest:${doc.uuid}:`;
  // A partially interrupted legacy payout can have mutated Actor data even if
  // the authoritative Quest receipt is missing. Inspect every Actor directly.
  for(const actor of game.actors??[]){
    const ledger=actor.getFlag?.(ID,"ledger")??[];
    if(ledger.some(row=>row.source===doc.uuid || String(row.key??"").startsWith(prefix)))
      return {allowed:false,reason:"A Character or Group has Renown history from this Quest."};
    const currency=actor.getFlag?.(ID,"paidCurrency")??[];
    if(currency.some(key=>String(key).startsWith(prefix)))
      return {allowed:false,reason:"A Character has received currency from this Quest."};
    for(const item of actor.items??[]){
      if(String(item.getFlag?.(ID,"rewardKey")??"").startsWith(prefix))
        return {allowed:false,reason:"A Character has received an Item from this Quest."};
    }
  }
  const assigned=(doc.getFlag(ID,"assignees")??[]).length;
  return {allowed:true,assigned};
}

/** Used by the Manager; callers must obtain confirmation before invoking. */
export async function deleteQuest(doc){
  assertGM();
  const status=questDeletionStatus(doc);
  if(!status.allowed)throw new Error(`Quest deletion blocked: ${status.reason}`);
  // Native document deletion emits deleteJournalEntry, refreshing the Manager.
  await doc.delete();
  return true;
}
