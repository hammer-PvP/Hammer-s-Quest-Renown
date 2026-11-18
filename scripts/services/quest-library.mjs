import {ID,assertGM,CLONE,factions,quests} from '../constants.mjs';
import {saveQuest,saveFaction,getGMNotes,validateManagedFolderNames,applyManagedFolderSettings} from './documents.mjs';
import {getFolderNames,getFolderColors,saveFolderNames,saveFolderColors} from './folder-settings.mjs';
import {getSavedClassCatalog,getSavedClassSources,discoverClasses,getClassCatalogOptions,saveClassCatalog} from './class-catalog.mjs';

const FORMAT='hammer-s-quest-renown-library';
const VERSION=1;
const makeId=()=>foundry.utils.randomID();
const own=(value)=>String(value??'').trim();

/** A copy is a new Quest definition, never a second payout or a second recipient list. */
export async function duplicateQuest(source){
  assertGM();
  if(source?.getFlag(ID,'kind')!=='quest')throw new Error('Select a managed Quest.');
  const d=CLONE(source.flags[ID]);
  delete d.kind;
  d.status='unavailable';d.assignment='none';d.assignees=[];d.progress={};
  d.payouts=[];d.failurePayouts=[];d.failureReversals=[];
  d.groupAwards={};d.groupFailures={};d.lootRecipientId='';d.objectiveProgress={};
  for(const field of ['activeTurnIn','activeFailureTurnIn','activeFailureReversal','activeSuccessReversal'])delete d[field];
  d.objectives=(d.objectives??[]).map(o=>({...o,id:makeId(),done:false}));
  d.renownRewards=(d.renownRewards??[]).map(r=>({...r,id:makeId()}));
  d.failurePenalties=(d.failurePenalties??[]).map(r=>({...r,id:makeId()}));
  return saveQuest(null,{...d,name:`${source.name} (Copy)`,notes:getGMNotes(source)});
}

export async function exportQuestLibrary(){
  assertGM();
  const factionRows=factions().map(doc=>({key:doc.uuid,name:doc.name,
    description:doc.getFlag(ID,'description')??'',image:doc.getFlag(ID,'image')??'',
    notes:getGMNotes(doc),ranks:CLONE(doc.getFlag(ID,'ranks')??[])}));
  const questRows=quests().map(doc=>{
    const d=doc.flags[ID];
    return {key:doc.uuid,name:doc.name,notes:getGMNotes(doc),
      factionKey:d.factionUuid??null,flavor:d.flavor??'',objectiveTracking:d.objectiveTracking??'global',
      objectives:(d.objectives??[]).map(o=>({id:o.id??makeId(),text:o.text,done:false})),
      currency:CLONE(d.currency??{}),items:CLONE(d.items??[]),
      renownRewards:(d.renownRewards??[]).map(r=>({...r,factionKey:r.factionUuid})),
      failurePenaltiesEnabled:!!d.failurePenaltiesEnabled,
      failurePenalties:(d.failurePenalties??[]).map(r=>({...r,factionKey:r.factionUuid})),
      failureCurrency:CLONE(d.failureCurrency??{}),failureItems:CLONE(d.failureItems??[])};
  });
  const required=new Set();
  for(const f of factionRows)for(const rank of f.ranks)for(const block of rank.benefits??[]){
    for(const item of block.items??[])if(item.uuid)required.add(item.uuid);
    for(const items of Object.values(block.classes??{}))for(const item of Array.isArray(items)?items:[])if(item.uuid)required.add(item.uuid);
  }
  for(const q of questRows)for(const item of [...q.items,...q.failureItems])if(item.uuid)required.add(item.uuid);
  const sourceItems=[];
  for(const uuid of required){
    const item=await fromUuid(uuid);
    if(item?.documentName!=='Item')throw new Error(`Cannot export missing Item source ${uuid}. Restore the Item or remove its reference.`);
    const data=item.toObject();delete data._id;delete data._stats;delete data.folder;
    if(data.flags?.[ID]){
      for(const key of ['rewardKey','rankGrantKey','rankFactionUuid','rankId','rankBlockId',
        'failureDebitKeys','failureRestoredKeys','sourceUuid'])delete data.flags[ID][key];
    }
    sourceItems.push({uuid,data});
  }
  return {format:FORMAT,version:VERSION,exportedAt:new Date().toISOString(),sourceItems,
    origin:game.world?.id??'',factions:factionRows,quests:questRows,settings:{
      folderNames:getFolderNames(),folderColors:getFolderColors(),
      classKeys:getSavedClassCatalog().selected,sourceIds:getSavedClassSources().selected}};
}

function validate(data){
  if(data?.format!==FORMAT||data.version!==VERSION||!Array.isArray(data.factions)||!Array.isArray(data.quests))
    throw new Error('This file is not a supported Quest & Renown library.');
  if(data.factions.length>1000||data.quests.length>5000||(data.sourceItems??[]).length>10000)throw new Error('Library is too large.');
  const validKeys=new Set();
  for(const row of [...data.factions,...data.quests]){
    if(!own(row.key)||!own(row.name)||validKeys.has(row.key))throw new Error('Library has invalid or duplicate record identifiers.');
    validKeys.add(row.key);
  }
  const facKeys=new Set(data.factions.map(f=>f.key));
  for(const q of data.quests){
    const refs=[q.factionKey,...(q.renownRewards??[]).map(r=>r.factionKey??r.factionUuid),...(q.failurePenalties??[]).map(r=>r.factionKey??r.factionUuid)].filter(Boolean);
    if(refs.some(ref=>!facKeys.has(ref)))throw new Error(`Quest "${q.name}" references a Faction missing from the library.`);
    if(!Array.isArray(q.objectives)||!Array.isArray(q.items)||!Array.isArray(q.renownRewards)||!Array.isArray(q.failurePenalties))
      throw new Error(`Invalid definitions in Quest "${q.name}".`);
  }
  return data;
}

/** Idempotent across refreshes: each origin record gets one new Journal, and no
 * original UUID is reused in the destination World. Never imports progress or
 * Actor history and never overwrites an existing Journal's content. */
export async function importQuestLibrary(payload,{applySettings=false}={}){
  assertGM();const data=validate(payload);
  let importedClassSettings=null;
  if(applySettings && data.settings){
    if(!data.settings.folderNames||!data.settings.folderColors)
      throw new Error('This library has no complete folder settings.');
    validateManagedFolderNames(data.settings.folderNames);
    const discovered=await discoverClasses({refresh:true});
    const knownSources=new Set(discovered.sources.map(x=>x.id));
    const sourceIds=(data.settings.sourceIds??[]);
    if(sourceIds.some(id=>!knownSources.has(id)))
      throw new Error('Some saved Class Sources do not exist in this World. Import content without World Settings.');
    const knownKeys=new Set(discovered.entries.flatMap(x=>[x.key,...(x.aliases??[])]));
    const selected=(data.settings.classKeys??[]);
    if(selected.some(key=>!knownKeys.has(key)))
      throw new Error('Some saved Classes are not installed in this World. Import without World Settings.');
    importedClassSettings={sourceIds,selected};
  }
  const importPrefix=`${own(data.origin)||'unknown-world'}:`;
  const records=new Map(),itemSources=new Map();let createdFactions=0,createdQuests=0,createdItems=0;
  // Portable Item snapshots are recreated only for missing Compendiums or
  // World Items. Existing source Items are not overwritten.
  for(const row of data.sourceItems??[]){
    if(!own(row.uuid)||!row.data?.name||!row.data?.type)throw new Error('Invalid Item source in library.');
    const originId=importPrefix+row.uuid;
    let source=game.items.find(item=>item.getFlag(ID,'libraryItemOrigin')===originId);
    if(!source&&row.uuid.startsWith('Compendium.'))source=await fromUuid(row.uuid);
    if(!source){
      const data=CLONE(row.data);delete data._id;delete data.folder;delete data._stats;
      data.flags??={};data.flags[ID]={...(data.flags[ID]??{}),libraryItemOrigin:originId};
      source=await Item.create(data);createdItems++;
    }
    itemSources.set(row.uuid,source.uuid);
  }
  const mapItem=item=>({...item,uuid:itemSources.get(item.uuid)??item.uuid});
  for(const row of data.factions){
    const originId=importPrefix+row.key;
    let doc=factions().find(f=>f.getFlag(ID,'importOrigin')===originId);
    if(!doc){
      const ranks=CLONE(row.ranks);
      for(const rank of ranks)for(const block of rank.benefits??[]){
        block.items=(block.items??[]).map(mapItem);
        if(block.classes)for(const [key,items] of Object.entries(block.classes))
          block.classes[key]=(Array.isArray(items)?items:[]).map(mapItem);
      }
      doc=await saveFaction(null,{name:row.name,description:row.description,image:row.image,notes:row.notes,ranks});
      await doc.setFlag(ID,'importOrigin',originId);createdFactions++;
    }
    records.set(row.key,doc.uuid);
  }
  for(const row of data.quests){
    const originId=importPrefix+row.key;
    if(quests().some(q=>q.getFlag(ID,'importOrigin')===originId))continue;
    const resolveKey=key=>key?records.get(key)??null:null;
    const values={name:row.name,notes:row.notes,flavor:row.flavor,factionUuid:resolveKey(row.factionKey),
      objectiveTracking:row.objectiveTracking==='individual'?'individual':'global',
      objectives:row.objectives.map(o=>({...o,id:makeId(),done:false})),
      currency:row.currency,items:row.items.map(mapItem),
      renownRewards:row.renownRewards.map(r=>({...r,id:makeId(),factionUuid:resolveKey(r.factionKey??r.factionUuid)})),
      failurePenaltiesEnabled:row.failurePenaltiesEnabled,
      failurePenalties:row.failurePenalties.map(r=>({...r,id:makeId(),factionUuid:resolveKey(r.factionKey??r.factionUuid)})),
      failureCurrency:row.failureCurrency??{},failureItems:(row.failureItems??[]).map(mapItem)};
    const doc=await saveQuest(null,values);
    await doc.setFlag(ID,'importOrigin',originId);createdQuests++;
  }
  if(applySettings&&data.settings){
    await saveFolderNames(data.settings.folderNames);
    await saveFolderColors(data.settings.folderColors);
    await applyManagedFolderSettings();
    if(importedClassSettings){
      const {entries}=await getClassCatalogOptions({refresh:true});
      await saveClassCatalog(importedClassSettings.selected,entries,{sourceIds:importedClassSettings.sourceIds});
    }
  }
  return {createdFactions,createdQuests,createdItems,skippedFactions:data.factions.length-createdFactions,skippedQuests:data.quests.length-createdQuests};
}
