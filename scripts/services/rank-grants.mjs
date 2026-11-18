import {ID,assertGM,eligible} from '../constants.mjs';
import {reputationOf,historyFor} from './reputation.mjs';
import {classKey,getEnabledClasses} from './class-catalog.mjs';

/** Benefit grants are explicit GM operations. Existing Actor Items are left
 * alone; only copies with an HQR provenance key participate in idempotency. */
export async function grantRankBenefits(actor,faction,enabledClasses=null){
  assertGM();
  if(!eligible(actor))throw new Error('Select a player-owned Character.');
  if(faction?.getFlag(ID,'kind')!=='faction')throw new Error('Select an HQR Faction.');
  if(!historyFor(actor).some(row=>row.factionUuid===faction.uuid))
    return {eligible:0,created:0,skipped:0};
  const value=reputationOf(actor,faction.uuid),ranks=faction.getFlag(ID,'ranks')??[];
  const permitted=enabledClasses??await getEnabledClasses();
  const characterClasses=new Set();
  for(const item of actor.items??[]){
    if(item.type!=='class')continue;
    const key=classKey(item.system?.identifier,item.name);
    const byName=classKey(null,item.name);
    for(const entry of permitted){
      if(key===entry.key||byName===entry.key||entry.aliases?.includes(key)||entry.aliases?.includes(byName))
        characterClasses.add(entry.key);
    }
  }
  const definitions=[];
  for(const rank of ranks){
    if(Number(rank.min)>value)continue;
    for(const block of rank.benefits??[]){
      if(block.type==='general'){
        for(const item of block.items??[])definitions.push({rank,block,item,slot:'general'});
      }else if(block.type==='classSpecific'){
        for(const [key,items] of Object.entries(block.classes??{})){
          if(!characterClasses.has(key))continue;
          for(const item of Array.isArray(items)?items:[])definitions.push({rank,block,item,slot:key});
        }
      }
    }
  }
  // Validate all sources before writing to the Actor: a missing Compendium
  // must not result in half the benefits of the same planned grant.
  const pending=[];let skipped=0;
  for(const row of definitions){
    const key=`rank:${faction.uuid}:${row.rank.id}:${row.block.id}:${row.slot}:${row.item.id??row.item.uuid}`;
    if(actor.items.some(i=>i.getFlag(ID,'rankGrantKey')===key)){skipped++;continue;}
    const source=await fromUuid(row.item.uuid);
    if(source?.documentName!=='Item')throw new Error(`Missing rank benefit source: ${row.item.name??row.item.uuid}`);
    pending.push({source,key,row});
  }
  let created=0;
  for(const {source,key,row} of pending){
    // Re-check on retries after an interrupted operation.
    if(actor.items.some(i=>i.getFlag(ID,'rankGrantKey')===key)){skipped++;continue;}
    const data=source.toObject();delete data._id;
    data.system??={};
    if('quantity' in data.system)data.system.quantity=Math.max(1,Math.trunc(Number(row.item.quantity)||1));
    data.flags??={};data.flags[ID]={...(data.flags[ID]??{}),rankGrantKey:key,
      rankFactionUuid:faction.uuid,rankId:row.rank.id,rankBlockId:row.block.id,
      sourceUuid:row.item.uuid};
    await actor.createEmbeddedDocuments('Item',[data]);created++;
  }
  return {eligible:definitions.length,created,skipped};
}

export async function grantRankBenefitsBatch(actors,faction){
  assertGM();
  const allowed=await getEnabledClasses();let created=0,eligibleCount=0,skipped=0;
  for(const actor of actors){
    const result=await grantRankBenefits(actor,faction,allowed);
    created+=result.created;eligibleCount+=result.eligible;skipped+=result.skipped;
  }
  return {actors:actors.length,created,eligible:eligibleCount,skipped};
}
