import {ID,assertGM,CURRENCIES} from '../constants.mjs';
import {historyFor,adjust} from './reputation.mjs';
import {reconcileAccess} from './documents.mjs';

const progressMap=doc=>doc.getFlag(ID,'progress')??{};
const runs=doc=>doc.getFlag(ID,'payouts')??[];
const findRun=(doc,id)=>runs(doc).find(r=>r.id===id);
const groupAwards=doc=>doc.getFlag(ID,'groupAwards')??{};
const v2=run=>Number(run?.keyVersion)>=2;
const personalCurrency=(doc,run,id)=>run.perActor?.[id]?.currency??run.currency??doc.getFlag(ID,'currency')??{};
const awardItems=(doc,run)=>run.items??doc.getFlag(ID,'items')??[];
const currencyKey=(doc,run,id)=>v2(run)?`quest:${doc.uuid}:currency:${run.id}:${id}`:`quest:${doc.uuid}:currency:${id}`;
const itemKey=(doc,run,index,id)=>v2(run)?`quest:${doc.uuid}:item:${run.id}:${index}:${id}`:`quest:${doc.uuid}:item:${index}:${id}`;
const renownKey=(doc,run,row,id)=>v2(run)?`quest:${doc.uuid}:renown:${run.id}:${row.id}:${id}`:`quest:${doc.uuid}:renown:${row.id}:${id}`;

export function completedCharacters(doc){
  return [...new Set(doc.getFlag(ID,'assignees')??[])].map(id=>({id,actor:game.actors.get(id),progress:progressMap(doc)[id]}))
    .filter(x=>x.actor?.type==='character'&&x.progress?.status==='completed')
    .map(x=>({id:x.id,name:x.actor.name,runId:x.progress.payoutId}));
}
export function reversibleSuccessGroups(doc,characterIds=[]){
  const selected=new Set(characterIds),progress=progressMap(doc);
  return Object.entries(groupAwards(doc)).flatMap(([id,credit])=>{
    const actor=game.actors.get(id),run=findRun(doc,credit?.payoutId);
    if(actor?.type!=='group'||!run)return [];
    const stillCompleted=(run.participants??[]).filter(cid=>progress[cid]?.status==='completed'&&progress[cid]?.payoutId===run.id);
    const available=stillCompleted.every(id=>selected.has(id));
    return [{id,name:actor.name,available,runId:run.id,
      note:available?'Eligible for optional Group Renown reversal':'Other Characters from this payout must also be selected'}];
  });
}
export function pendingSuccessReversal(doc){
  const plan=doc?.getFlag(ID,'activeSuccessReversal');
  return plan?.schema===1&&typeof plan.id==='string'&&Array.isArray(plan.characters)?plan:null;
}
function renownRows(doc,actor,run,kind){
  return (run.rows??[]).filter(row=>row[kind]).flatMap(row=>{
    const key=renownKey(doc,run,row,actor.id);
    const entry=historyFor(actor).find(r=>r.key===key&&r.source===doc.uuid&&r.factionUuid===row.factionUuid);
    // A disabled or zero-value row creates no ledger entry.
    const amount=kind==='personal'&&v2(run)?Number(run.perActor?.[actor.id]?.renown?.[row.id]??row.amount):Number(row.amount);
    if(amount===0)return [];
    if(!entry||Number(entry.delta)!==amount)throw new Error(`Renown entry for ${actor.name} is missing or modified (${row.id}).`);
    return [{key,factionUuid:row.factionUuid,delta:amount}];
  });
}
function originalCharacter(doc,id){
  const actor=game.actors.get(id),state=progressMap(doc)[id];
  const run=findRun(doc,state?.payoutId);
  if(!actor||!run||state.status!=='completed')throw new Error(`Character ${id} has no reversible Success Turn-In.`);
  const amountMap=personalCurrency(doc,run,id);
  const currency=Object.fromEntries(CURRENCIES.map(k=>[k,Math.max(0,Math.trunc(Number(amountMap[k])||0))]));
  const items=awardItems(doc,run).flatMap((row,index)=>{
    const amount=v2(run)?Number(run.perActor?.[id]?.itemQuantities?.[index]??row.quantity):Math.max(1,Math.trunc(Number(row.quantity)||1));
    return amount>0?[{key:itemKey(doc,run,index,id),amount,name:row.name??'Item'}]:[];
  });
  return {id,payoutId:run.id,currency,currencyKey:currencyKey(doc,run,id),items,
    renown:renownRows(doc,actor,run,'personal'),restoreStatus:'accepted'};
}
function originalGroup(doc,id){
  const actor=game.actors.get(id),credit=groupAwards(doc)[id],run=findRun(doc,credit?.payoutId);
  if(actor?.type!=='group'||!run)throw new Error(`Group ${id} has no reversible Renown receipt.`);
  return {id,payoutId:run.id,renown:renownRows(doc,actor,run,'group')};
}
function validateInventory(doc,entry,planId=null){
  const actor=game.actors.get(entry.id);
  if(!actor)throw new Error(`Recipient ${entry.id} no longer exists.`);
  const reversed=actor.getFlag(ID,'successReversedCurrency')??[];
  const currencyReceipt=actor.getFlag(ID,'paidCurrency')??[];
  const reversalKey=planId?`quest:${doc.uuid}:success-reversal:${planId}:currency:${entry.id}`:null;
  if(CURRENCIES.some(k=>Number(entry.currency[k])>0)){
    if(!currencyReceipt.includes(entry.currencyKey))throw new Error(`Currency payment record is missing for ${actor.name}.`);
    if(!reversalKey||!reversed.includes(reversalKey)){
      for(const k of CURRENCIES)if(Number(actor.system?.currency?.[k]??0)<Number(entry.currency[k]??0))
        throw new Error(`${actor.name} has already spent the ${k.toUpperCase()} required for Undo Success.`);
    }
  }
  for(const row of entry.items){
    const reversedItemKey=planId?`quest:${doc.uuid}:success-reversal:${planId}:item:${entry.id}:${row.key}`:null;
    const isRegistered=reversedItemKey&&(actor.getFlag(ID,'successReversedItems')??[]).includes(reversedItemKey);
    const item=actor.items.find(i=>i.getFlag(ID,'rewardKey')===row.key);
    if(isRegistered&&!item)continue;
    if(!item)throw new Error(`${actor.name} no longer has the original awarded Item ${row.name}.`);
    if(Number(item.system?.quantity??0)!==Number(row.amount) || item.system?.equipped===true)
      throw new Error(`The awarded ${row.name} on ${actor.name} was modified or equipped; return it to its original quantity before reversing.`);
  }
}
export async function undoQuestSuccess(doc,{characterIds=[],groupIds=[],reason=''}={}){
  assertGM();
  if(doc?.getFlag(ID,'kind')!=='quest')throw new Error('Select a managed Quest.');
  if(['activeTurnIn','activeFailureTurnIn','activeFailureReversal'].some(k=>!!doc.getFlag(ID,k)))
    throw new Error('Resolve all pending Quest transactions before Undo Success.');
  let plan=pendingSuccessReversal(doc);
  if(!plan&&doc.getFlag(ID,'activeSuccessReversal'))throw new Error('Unknown pending Success reversal. No changes made.');
  if(!plan){
    const ids=[...new Set(characterIds)],why=String(reason??'').trim();
    if(!ids.length||!why)throw new Error('Select Completed Characters and provide a correction reason.');
    const allowed=new Set(completedCharacters(doc).map(r=>r.id));
    if(ids.some(id=>!allowed.has(id)))throw new Error('Selected Character is not Completed.');
    const allowedGroups=new Set(reversibleSuccessGroups(doc,ids).filter(r=>r.available).map(r=>r.id));
    const groups=[...new Set(groupIds)];
    if(groups.some(id=>!allowedGroups.has(id)))throw new Error('A selected Group still has completed recipients outside this reversal.');
    const characters=ids.map(id=>originalCharacter(doc,id));
    const groupPlans=groups.map(id=>originalGroup(doc,id));
    for(const row of characters)validateInventory(doc,row);
    plan={schema:1,id:foundry.utils.randomID(),characters,groups:groupPlans,reason:why,
      gmUserId:game.user.id,createdAt:new Date().toISOString()};
    await doc.setFlag(ID,'activeSuccessReversal',plan);
  }
  for(const entry of plan.characters)validateInventory(doc,entry,plan.id);
  let compensated=0,removedItems=0;
  for(const entry of [...plan.characters,...plan.groups]){
    const actor=game.actors.get(entry.id);
    if(!actor||!['group','character'].includes(actor.type))throw new Error(`Actor ${entry.id} is missing.`);
    for(const row of entry.renown??[]){
      if(!historyFor(actor).some(x=>x.key===row.key&&x.factionUuid===row.factionUuid&&Number(x.delta)===row.delta))
        throw new Error(`Original Renown on ${actor.name} was changed. Resume after restoring it.`);
      if(await adjust(actor,row.factionUuid,-row.delta,`Undo quest success: ${doc.name}. ${plan.reason}`,
        {source:doc.uuid,key:`quest:${doc.uuid}:success-reversal:${plan.id}:${actor.id}:${row.key}`,reconcile:false}))compensated++;
    }
    if(entry.currency){
      const key=`quest:${doc.uuid}:success-reversal:${plan.id}:currency:${actor.id}`;
      const flags=actor.getFlag(ID,'successReversedCurrency')??[];
      if(!flags.includes(key)){
        const changes={[`flags.${ID}.successReversedCurrency`]:[...flags,key]};
        for(const k of CURRENCIES){
          const amount=Number(entry.currency[k]??0);
          if(amount){if(Number(actor.system?.currency?.[k]??0)<amount)throw new Error(`${actor.name} has insufficient ${k.toUpperCase()} for Undo Success.`);
            changes[`system.currency.${k}`]=Number(actor.system.currency[k])-amount;}
        }
        await actor.update(changes);compensated++;
      }
    }
    for(const row of entry.items??[]){
      const key=`quest:${doc.uuid}:success-reversal:${plan.id}:item:${actor.id}:${row.key}`;
      const record=actor.getFlag(ID,'successReversedItems')??[];
      const item=actor.items.find(i=>i.getFlag(ID,'rewardKey')===row.key);
      if(record.includes(key)){if(item)await item.delete();continue;}
      if(!item)throw new Error(`Cannot remove missing reward Item ${row.name} from ${actor.name}.`);
      if(Number(item.system?.quantity??0)!==Number(row.amount) || item.system?.equipped===true)
        throw new Error(`Cannot remove modified or equipped reward Item ${row.name}.`);
      // Durable marker BEFORE deletion: after F5, retry finds marker and
      // removes an Item still present, or knows deletion already completed.
      await actor.setFlag(ID,'successReversedItems',[...record,key]);
      await item.delete();removedItems++;
    }
  }
  const progress={...progressMap(doc)};
  for(const entry of plan.characters){
    const state=progress[entry.id]??{};
    if(state.status!=='completed'||state.payoutId!==entry.payoutId)
      throw new Error(`The completed result of ${entry.id} changed during reversal.`);
    const {completedAt,payoutId,...rest}=state;
    progress[entry.id]={...rest,status:entry.restoreStatus,lastSuccessReversalId:plan.id,
      lastSuccessReversalAt:new Date().toISOString()};
  }
  const groups={...groupAwards(doc)};
  for(const entry of plan.groups){
    if(groups[entry.id]?.payoutId!==entry.payoutId)throw new Error(`Group ${entry.id} receipt has changed.`);
    delete groups[entry.id];
  }
  const history=[...(doc.getFlag(ID,'successReversals')??[])];
  if(!history.some(row=>row.id===plan.id))history.push({id:plan.id,at:new Date().toISOString(),
    reason:plan.reason,gmUserId:plan.gmUserId,characterIds:plan.characters.map(x=>x.id),
    groupIds:plan.groups.map(x=>x.id),compensatedRenown:compensated,removedItems});
  await doc.update({[`flags.${ID}.progress`]:foundry.data.operators.ForcedReplacement.create(progress),
    [`flags.${ID}.groupAwards`]:foundry.data.operators.ForcedReplacement.create(groups),
    [`flags.${ID}.successReversals`]:history,
    [`flags.${ID}.activeSuccessReversal`]:new foundry.data.operators.ForcedDeletion()});
  await reconcileAccess();
  ui.notifications.info(`Success reversed for ${plan.characters.length} Character(s): ${doc.name}`);
  return {characters:plan.characters.length,groups:plan.groups.length,id:plan.id};
}
