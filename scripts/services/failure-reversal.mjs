/**
 * v0.0.8: Auditable, resumable Undo Failure for production Worlds.
 * Original Failure Turn-Ins and Actor ledger rows are NEVER deleted.
 * Changes are compensating ledger entries with immutable keys, recorded before
 * individual outcomes are restored, so an interrupted reversal is safe to resume.
 */
import {ID, assertGM} from "../constants.mjs";
import {reconcileAccess} from "./documents.mjs";
import {adjust, historyFor} from "./reputation.mjs";

const failureRuns = doc => doc.getFlag(ID, "failurePayouts") ?? [];
const failureRun = (doc,id) => failureRuns(doc).find(run => run.id === id) ?? null;
const progressMap = doc => doc.getFlag(ID, "progress") ?? {};
const groupMap = doc => doc.getFlag(ID, "groupFailures") ?? {};

export function failedCharacters(doc) {
  return [...new Set(doc?.getFlag(ID,"assignees") ?? [])]
    .map(id => ({actor:game.actors.get(id), outcome:progressMap(doc)[id]}))
    .filter(({actor,outcome}) => actor?.type === "character" && outcome?.status === "failed")
    .map(({actor,outcome}) => ({id:actor.id,name:actor.name,failedAt:outcome.failedAt ?? "",
      runId:outcome.failurePayoutId ?? null,legacy:!outcome.failurePayoutId}));
}

/** The group may only be un-penalized if no Character in its original
 * Failure Turn-In remains failed after this reversal. Never undo it implicitly.
 */
export function reversibleGroups(doc,characterIds=[]) {
  const selected = new Set(characterIds);
  const progress = progressMap(doc);
  return Object.entries(groupMap(doc)).flatMap(([id,credit]) => {
    const actor=game.actors.get(id);
    const run=failureRun(doc,credit?.payoutId);
    if(actor?.type!=="group" || !run) return [];
    const affected=(run.participants??[]).filter(cid=>progress[cid]?.status==="failed" && progress[cid]?.failurePayoutId===run.id);
    const available=affected.length>0 && affected.every(cid=>selected.has(cid));
    return [{id,name:actor.name,runId:run.id,available,
      note:available?"Eligible for explicit Group penalty reversal":"Other participants from this failure must also be selected"}];
  });
}

function originalKey(doc,run,row,actorId){
  // Failures issued before v0.0.8 used a key without a Turn-In id.
  return Number(run.keyVersion) >= 2
    ? `quest:${doc.uuid}:failure:${run.id}:${row.id}:${actorId}`
    : `quest:${doc.uuid}:failure:${row.id}:${actorId}`;
}

function originalPenalties(doc,actor,run,kind){
  if(!run) return [];
  const ledger=historyFor(actor);
  return (run.rows??[]).filter(row=>row[kind] && Number(row.amount)<0).flatMap(row=>{
    const key=originalKey(doc,run,row,actor.id);
    const entry=ledger.find(e=>e.key===key && e.source===doc.uuid && e.factionUuid===row.factionUuid);
    // Credit back ONLY penalties proven to have been actually written.
    if(!entry || !Number.isSafeInteger(Number(entry.delta)) || Number(entry.delta)>=0) return [];
    return [{actorId:actor.id,sourceKey:key,factionUuid:entry.factionUuid,delta:Number(entry.delta)}];
  });
}

export function pendingFailureReversal(doc) {
  const plan=doc?.getFlag(ID,"activeFailureReversal") ?? null;
  return plan && plan.schema===1 && typeof plan.id==="string" && Array.isArray(plan.characters) ? plan : null;
}

export async function undoQuestFailure(doc,{characterIds=[],groupIds=[],reason=""}={}) {
  assertGM();
  if(doc?.getFlag(ID,"kind")!=="quest") throw new Error("Select a managed Quest Journal.");
  if(doc.getFlag(ID,"activeTurnIn") || doc.getFlag(ID,"activeFailureTurnIn"))
    throw new Error("Resolve the interrupted Turn-In before undoing a failure.");
  let plan=pendingFailureReversal(doc);
  if(!plan && doc.getFlag(ID,"activeFailureReversal"))
    throw new Error("An unrecognized pending reversal exists. Do not clear it; contact the maintainer.");
  if(!plan){
    const ids=[...new Set(characterIds)];
    if(!ids.length) throw new Error("Select at least one Failed Character to restore.");
    const rationale=String(reason??"").trim();
    if(!rationale) throw new Error("Explain why this Failure Turn-In is being reversed.");
    const candidates=new Map(failedCharacters(doc).map(x=>[x.id,x]));
    if(ids.some(id=>!candidates.has(id)))
      throw new Error("One or more Characters are not currently Failed. Refresh the results.");
    const groups=[...new Set(groupIds)];
    const allowed=new Map(reversibleGroups(doc,ids).filter(g=>g.available).map(g=>[g.id,g]));
    if(groups.some(id=>!allowed.has(id)))
      throw new Error("The selected Group cannot be reversed while another participant from that Failure remains Failed.");
    const progress=progressMap(doc);
    const chars=ids.map(id=>{
      const outcome=progress[id];
      const run=failureRun(doc,outcome.failurePayoutId);
      // v0.0.7 did not snapshot previous progress. 'Accepted' is the safe
      // fallback; new Failure Turn-Ins store previousStatus for exact recovery.
      return {id,payoutId:outcome.failurePayoutId??null,
        restoreStatus:["accepted","in-progress"].includes(outcome.previousStatus)?outcome.previousStatus:"accepted",
        previousFailedAt:outcome.failedAt??null,
        penalties:originalPenalties(doc,game.actors.get(id),run,"personal")};
    });
    const groupPlans=groups.map(id=>{
      const credit=groupMap(doc)[id];
      return {id,payoutId:credit.payoutId,
        penalties:originalPenalties(doc,game.actors.get(id),failureRun(doc,credit.payoutId),"group")};
    });
    plan={schema:1,id:foundry.utils.randomID(),characters:chars,groups:groupPlans,
      reason:rationale,createdAt:new Date().toISOString(),gmUserId:game.user.id};
    // Persist immutable intent before writing to ANY Actor.
    await doc.setFlag(ID,"activeFailureReversal",plan);
  }
  // A saved plan must be resumed as-is; this also works after F5/restart.
  if(plan.schema!==1 || !plan.id || !Array.isArray(plan.groups) || !String(plan.reason).trim())
    throw new Error("Pending reversal data is invalid; no new changes applied.");
  let compensated=0;
  for(const item of [...plan.characters,...plan.groups]){
    const actor=game.actors.get(item.id);
    if(!actor || !["character","group"].includes(actor.type))
      throw new Error(`Missing Actor ${item.id}. Restore it before resuming.`);
    for(const penalty of item.penalties??[]){
      const entry=historyFor(actor).find(row=>row.key===penalty.sourceKey);
      if(!entry || entry.source!==doc.uuid || entry.factionUuid!==penalty.factionUuid || Number(entry.delta)!==penalty.delta)
        throw new Error(`Original penalty for ${actor.name} is missing or modified. Nothing new was credited for this row.`);
      const key=`quest:${doc.uuid}:failure-reversal:${plan.id}:${actor.id}:${penalty.sourceKey}`;
      if(await adjust(actor,penalty.factionUuid,-penalty.delta,
        `Undo quest failure: ${doc.name}. ${plan.reason}`,{source:doc.uuid,key,reconcile:false})) compensated++;
    }
  }
  const progress={...progressMap(doc)};
  for(const item of plan.characters){
    const old=progress[item.id]??{};
    if(old.status!=="failed" || (old.failurePayoutId??null)!==item.payoutId)
      throw new Error(`Status of Character ${item.id} changed during reversal; no progress was overwritten.`);
    const {failedAt,failurePayoutId,legacyAutoFailedAt,previousStatus,reason:oldReason,...previous}=old;
    progress[item.id]={...previous,status:item.restoreStatus,
      lastFailureReversalId:plan.id,lastFailureReversalAt:new Date().toISOString()};
  }
  const groupFailures={...groupMap(doc)};
  for(const item of plan.groups){
    if(groupFailures[item.id]?.payoutId!==item.payoutId)
      throw new Error(`Group ${item.id} changed its Failure attribution; no results were overwritten.`);
    delete groupFailures[item.id];
  }
  const when=new Date().toISOString();
  const audit=[...(doc.getFlag(ID,"failureReversals")??[])];
  if(!audit.some(entry=>entry.id===plan.id)) audit.push({id:plan.id,at:when,reason:plan.reason,gmUserId:plan.gmUserId,
    characterIds:plan.characters.map(item=>item.id),groupIds:plan.groups.map(item=>item.id),
    compensatedPenalties:plan.characters.concat(plan.groups).flatMap(item=>item.penalties??[]).length});
  await doc.update({[`flags.${ID}.progress`]:foundry.data.operators.ForcedReplacement.create(progress),
    [`flags.${ID}.groupFailures`]:foundry.data.operators.ForcedReplacement.create(groupFailures),
    [`flags.${ID}.failureReversals`]:audit,
    [`flags.${ID}.activeFailureReversal`]:new foundry.data.operators.ForcedDeletion()});
  await reconcileAccess();
  ui.notifications.info(`Failure reversed for ${plan.characters.length} Character(s): ${doc.name}.`);
  return {characters:plan.characters.length,groups:plan.groups.length,compensated,id:plan.id};
}
