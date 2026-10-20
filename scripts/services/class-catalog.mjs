/**
 * Rank Benefits — independent Class Sources and logical Enabled Classes (v0.1.8).
 * Selecting multiple permitted sources authorizes ALL class definitions from
 * those sources. A single class:<name> slot matches any allowed definition,
 * but no Item/Spell/Feature grants are performed by this module version.
 *
 * World settings v3 retain legacy snapshots and exact per-source UUIDs.
 * Existing Faction rank slots and Journal/Actor data are never rewritten.
 */
import {ID,assertGM} from '../constants.mjs';

export const CLASS_CATALOG_SETTING='rankClassCatalog';
export const CLASS_SOURCES_SETTING='rankClassSources';
const BASE_PACK='dnd5e.classes';
const SOURCE_EMPTY=()=>({schema:2,initialized:false,selected:[]});
const CATALOG_EMPTY=()=>({schema:3,initialized:false,selected:[],known:{},bindings:{}});
let discoveryCache=null,discoverySignature='';
const safeText=v=>String(v??'').trim();
function slug(value){return safeText(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
export function classKey(identifier,name){const token=slug(identifier)||slug(name);return token?`class:${token}`:'';}
export function registerClassCatalogSettings(){
  game.settings.register(ID,CLASS_CATALOG_SETTING,{name:'Rank Benefits — Enabled Classes',scope:'world',config:false,type:Object,default:CATALOG_EMPTY()});
  game.settings.register(ID,CLASS_SOURCES_SETTING,{name:'Rank Benefits — Class Sources',scope:'world',config:false,type:Object,default:SOURCE_EMPTY()});
}
function uniqueStrings(value){return [...new Set((Array.isArray(value)?value:[]).filter(x=>typeof x==='string'&&x.trim()))];}
export function getSavedClassCatalog(){
  const raw=game.settings.get(ID,CLASS_CATALOG_SETTING)??{};
  return {schema:Number(raw.schema)||1,initialized:raw.initialized===true,
    selected:uniqueStrings(raw.selected).filter(x=>x.startsWith('class:')),
    known:raw.known&&typeof raw.known==='object'&&!Array.isArray(raw.known)?raw.known:{},
    bindings:raw.bindings&&typeof raw.bindings==='object'&&!Array.isArray(raw.bindings)?raw.bindings:{}};
}
export function getSavedClassSources(){
  const raw=game.settings.get(ID,CLASS_SOURCES_SETTING)??{};
  return {schema:Number(raw.schema)||1,initialized:raw.initialized===true,selected:uniqueStrings(raw.selected)};
}
function packConfig(){try{return game.settings.get('dnd5e','packSourceConfiguration')??{};}catch(e){console.warn(`${ID} | Cannot read D&D5e pack sources`,e);return {};}}
function allowedPacks(){const conf=packConfig();return [...game.packs.values()].filter(p=>p.documentName==='Item'&&p.visible!==false&&conf[p.collection]!==false);}
function signature(packs){return packs.map(p=>p.collection).sort().join('|')+'::'+game.items.filter(i=>i.type==='class').map(i=>`${i.id}:${i.name}:${i.system?.identifier??''}`).sort().join('|');}
export function formatClassSource(raw,rules=''){
  const value=safeText(raw);if(!value)return '';
  const hint=safeText(rules);
  const year=/\b2024\b|\b5\.2\b|PHB[ -]?(?:20)?24\b/i.test(`${value} ${hint}`)?'2024':/\b2014\b|\b5\.1\b|PHB[ -]?(?:20)?14\b/i.test(`${value} ${hint}`)?'2014':'';
  if(/^PHB(?:[\s-]?(?:20)?(?:14|24))?$/i.test(value)||/^Player.?s Handbook(?:\s*\(?20(?:14|24)\)?)?$/i.test(value))return `Player's Handbook${year?` (${year})`:''}`;
  if(/^SRD\s*5\.?[12]$/i.test(value))return value.replace(/\s+/g,' ').replace(/5\.?([12])$/,'5.$1');
  return value;
}
function documentSource(entry){
  const source=entry?.system?.source;if(!source)return '';
  if(typeof source==='string')return formatClassSource(source);
  if(typeof source!=='object')return '';
  for(const field of [source.book,source.custom,source.title]){const value=formatClassSource(field,source.rules??source.revision??'');if(value)return value;}
  return '';
}
function sourceLabel(entry,pack){return documentSource(entry)||formatClassSource(pack?.metadata?.flags?.dnd5e?.sourceBook)||safeText(pack?.title??pack?.metadata?.label??pack?.collection)||'Unknown source';}
function editionOf(entry,source){const hint=`${safeText(entry?.system?.source?.rules)} ${safeText(source)}`;return /\b2024\b|\b5\.2\b/i.test(hint)?'2024':/\b2014\b|\b5\.1\b/i.test(hint)?'2014':'';}
function variant(entry,sourceId,uuid,packTitle='',packBook=''){
  const name=safeText(entry?.name),identifier=safeText(entry?.system?.identifier)||slug(name),key=classKey(identifier,name);
  if(!key||!name||!uuid)return null;
  const source=sourceLabel(entry,{title:packTitle,metadata:{flags:{dnd5e:{sourceBook:packBook}}}});
  return {key,name,identifier,sourceId,uuid,source,edition:editionOf(entry,source),packTitle};
}
function sortVariants(a,b){return a.source.localeCompare(b.source)||a.sourceId.localeCompare(b.sourceId)||a.uuid.localeCompare(b.uuid);}
/** Individual source documents are never discarded when identifiers collide.
 * Identical class names from authorized books share ONE logical slot, with
 * their alternative Item UUIDs preserved as separate eligible definitions.
 */
export async function discoverClasses({refresh=false}={}){
  assertGM();const packs=allowedPacks(),sig=signature(packs);
  if(!refresh&&discoveryCache&&discoverySignature===sig)return discoveryCache;
  const rows=[],sources=new Map(),errors=[];
  const offer=row=>{if(!row||rows.some(v=>v.uuid===row.uuid))return;
    rows.push(row);
    const source=sources.get(row.sourceId);
    if(source){source.count++;if(!source.books.includes(row.source))source.books.push(row.source);}
    else sources.set(row.sourceId,{id:row.sourceId,name:row.sourceId==='world'?'World Items':(row.packTitle||row.sourceId),count:1,books:[row.source],isWorld:row.sourceId==='world'});
  };
  for(const item of game.items.filter(i=>i.type==='class'))offer(variant(item,'world',item.uuid,'World Items',''));
  const todo=[...packs];
  await Promise.all(Array.from({length:Math.min(todo.length,4)},async()=>{
    while(todo.length){const pack=todo.shift(),types=pack.metadata?.flags?.dnd5e?.types;
      if(Array.isArray(types)&&types.length&&!types.includes('class'))continue;
      try{const idx=await pack.getIndex({fields:['type','system.identifier','system.source','flags.dnd5e.sourceId']});
        for(const item of idx){if(item.type!=='class')continue;const id=item._id??item.id;if(!id)continue;
          offer(variant(item,pack.collection,`Compendium.${pack.collection}.Item.${id}`,safeText(pack.title??pack.metadata?.label),pack.metadata?.flags?.dnd5e?.sourceBook));}
      }catch(error){errors.push(pack.collection);console.warn(`${ID} | Could not index class source ${pack.collection}`,error);}
    }
  }));
  // Name-based group unifies e.g. PHB Fighter and a supplementary Fighter
  // even when their system.identifier values differ. Preserve all aliases so
  // previously saved class:<identifier> choices can be reconciled on upgrade.
  const byName=new Map();
  for(const row of rows){const nameId=slug(row.name);
    let group=byName.get(nameId);
    if(!group){group={name:row.name,variants:[]};byName.set(nameId,group);}
    group.variants.push(row);
  }
  const entries=[...byName.values()].map(g=>{
    g.variants.sort(sortVariants);
    const canonical=g.variants.find(v=>v.key===`class:${slug(g.name)}`)??g.variants[0];
    return {key:canonical.key,name:canonical.name,identifier:canonical.identifier,
      aliases:[...new Set(g.variants.map(v=>v.key))],variants:g.variants};
  }).sort((a,b)=>a.name.localeCompare(b.name));
  const sourceOptions=[...sources.values()].map(s=>({...s,books:s.books.sort(),bookLabel:s.books.join(' · ')})).sort((a,b)=>a.name.localeCompare(b.name));
  discoveryCache={entries,sources:sourceOptions,errors};discoverySignature=sig;return discoveryCache;
}
function legacySnapshots(binding){
  if(Array.isArray(binding?.definitions))return binding.definitions;
  if(Array.isArray(binding?.variants))return binding.variants;
  return binding?.uuid?[binding]:[];
}
function savedSourceSet(discovered,stored=getSavedClassSources(),catalog=getSavedClassCatalog()){
  if(stored.initialized)return new Set(stored.selected);
  const ids=new Set();
  for(const key of catalog.selected){
    const snapshots=[...legacySnapshots(catalog.bindings[key]),catalog.known[key]];
    for(const item of snapshots){const uuid=safeText(item?.uuid);
      for(const src of discovered.sources)if(src.id==='world'?uuid.startsWith('Item.'):uuid.startsWith(`Compendium.${src.id}.Item.`))ids.add(src.id);
    }
  }
  if(ids.size)return ids;
  const sources=new Set(discovered.sources.map(s=>s.id));
  return new Set([sources.has(BASE_PACK)?BASE_PACK:(sources.has('dnd5e.classes24')?'dnd5e.classes24':'')].filter(Boolean));
}
function aliasesSelected(group,selected){return group.aliases.some(key=>selected.has(key));}
/** A separate Class Sources screen authorizes packs; a logical class is a
 * checkbox that accepts ALL definitions found in those authorized packs.
 */
export async function getClassCatalogOptions({refresh=false}={}){
  const discovered=await discoverClasses({refresh}),stored=getSavedClassCatalog(),sourceStore=getSavedClassSources();
  const authorized=savedSourceSet(discovered,sourceStore,stored),selected=new Set(stored.selected);
  const known={...stored.known};
  const defaultPack=discovered.sources.some(src=>src.id===BASE_PACK)?BASE_PACK:'dnd5e.classes24';
  const entries=discovered.entries.map(group=>{
    const definitions=group.variants.filter(v=>authorized.has(v.sourceId));
    const enabled=stored.initialized?aliasesSelected(group,selected):group.variants.some(v=>v.sourceId===defaultPack&&authorized.has(v.sourceId));
    return {...group,enabled,definitions,unavailable:!definitions.length,
      definitionCount:definitions.length,sourceLabel:definitions.length?`${definitions.length} valid definition${definitions.length===1?'':'s'}`:'No permitted class source'};
  });
  for(const key of selected){if(entries.some(e=>e.aliases.includes(key)))continue;
    const last=known[key]??{},snapshot=legacySnapshots(stored.bindings[key]);
    entries.push({key,name:safeText(last.name)||key,aliases:[key],identifier:key.slice(6),enabled:true,unavailable:true,
      variants:[],definitions:[],definitionCount:0,sourceLabel:snapshot.length?'Previously selected · Source unavailable':'Previously selected · Review sources'});
  }
  entries.sort((a,b)=>a.name.localeCompare(b.name));
  const sources=discovered.sources.map(s=>({...s,enabled:authorized.has(s.id)}));
  for(const id of authorized)if(!sources.some(s=>s.id===id))
    sources.push({id,name:id,count:0,books:[],bookLabel:'Currently unavailable · Previous selection retained',isWorld:id==='world',enabled:true,missing:true});
  return {entries,sources,errors:discovered.errors,initialized:stored.initialized,sourcesInitialized:sourceStore.initialized};
}
/** Return one row per logical class. 'definitions' is the authorized OR-set
 * future grant matching must use. A previous single UUID is provided solely
 * for backward compatibility; it is NOT an eligibility filter.
 */
export async function getEnabledClasses({refresh=false}={}){
  const data=await getClassCatalogOptions({refresh});
  return data.entries.filter(e=>e.enabled).map(e=>({key:e.key,name:e.name,
    uuid:e.definitions[0]?.uuid??'',sourceId:e.definitions[0]?.sourceId??'',source:e.definitions[0]?.source??'',
    definitions:e.definitions.map(d=>({...d})),
    unavailable:e.definitions.length===0,ambiguous:false}));
}
/** Resolve the World configuration before writing any settings. An authorized
 * source is not allowed to choose exactly one class variant accidentally.
 * All discovered definitions are stored independently and offered as an OR.
 */
export async function validateClassCatalogDraft(selectedKeys,entries,{sourceIds=null}={}){
  assertGM();const discovered=await discoverClasses(),old=getSavedClassCatalog(),sourceStore=getSavedClassSources();
  const chosenSources=sourceIds===null?savedSourceSet(discovered,sourceStore,old):new Set(uniqueStrings(sourceIds));
  const discoveredIds=new Set(discovered.sources.map(s=>s.id));
  const previouslySelected=new Set(sourceStore.selected);
  for(const id of chosenSources)if(!discoveredIds.has(id)&&!previouslySelected.has(id))throw new Error(`Unknown class source: ${id}`);
  const selected=[],known={...old.known},bindings={...old.bindings};
  const requested=new Set(uniqueStrings(selectedKeys));
  for(const entry of entries){if(!entry.aliases?.some(key=>requested.has(key))&&!requested.has(entry.key))continue;
    const key=entry.key;if(selected.includes(key))continue;selected.push(key);
    const group=discovered.entries.find(g=>g.key===entry.key||g.aliases.includes(entry.key));
    const definitions=(group?.variants??[]).filter(v=>chosenSources.has(v.sourceId));
    const last=old.bindings[key]??{},legacy=legacySnapshots(last);
    // If the configured source disappears, keep known provenance for audit;
    // missing definitions are NOT eligible for future grants.
    const snapshot=definitions.length?definitions.map(v=>({uuid:v.uuid,sourceId:v.sourceId,source:v.source,
      edition:v.edition,identifier:v.identifier,name:v.name})):legacy;
    bindings[key]={definitions:snapshot};
    known[key]={...old.known[key],name:entry.name,uuid:definitions[0]?.uuid??old.known[key]?.uuid??'',
      sourceId:definitions[0]?.sourceId??old.known[key]?.sourceId??'',
      source:definitions[0]?.source??old.known[key]?.source??''};
  }
  // Retain unknown/orphan selected keys rather than deleting historical
  // choices when an installed compendium temporarily disappears.
  for(const key of requested)if(!entries.some(e=>e.key===key||e.aliases?.includes(key)))
    if(old.selected.includes(key)){selected.push(key);bindings[key]=old.bindings[key];known[key]=old.known[key];}
  return {selected,known,bindings,allowed:[...chosenSources]};
}
export async function saveClassCatalog(selectedKeys,entries,options={}){
  const {selected,known,bindings,allowed}=await validateClassCatalogDraft(selectedKeys,entries,options);
  if(options.sourceIds!==null&&options.sourceIds!==undefined)
    await game.settings.set(ID,CLASS_SOURCES_SETTING,{schema:2,initialized:true,selected:allowed});
  await game.settings.set(ID,CLASS_CATALOG_SETTING,{schema:3,initialized:true,selected,known,bindings});
  return selected.length;
}
/** Additive conversion of schema <=2. Does not touch any Faction Journal,
 * logical rank slot, Item, Quest, or Actor ledger. Later source edits rebuild
 * the authorized definition OR-sets from the exact selected documents.
 */
export async function migrateLegacyClassCatalog(){
  assertGM();const old=getSavedClassCatalog();if(old.schema>=3)return false;
  const bindings={};
  for(const [key,value] of Object.entries(old.bindings))bindings[key]={definitions:legacySnapshots(value)};
  for(const key of old.selected)if(!bindings[key]?.definitions?.length){
    const known=old.known[key],uuid=safeText(known?.uuid);if(!uuid)continue;
    let sourceId=safeText(known?.sourceId);
    if(!sourceId){const match=/^Compendium\.([^.]+\.[^.]+)\.Item\./.exec(uuid);if(match)sourceId=match[1];}
    if(!sourceId&&uuid.startsWith('Item.'))sourceId='world';
    bindings[key]={definitions:[{sourceId,uuid,source:safeText(known?.source),identifier:key.slice(6),name:safeText(known?.name)}]};
  }
  await game.settings.set(ID,CLASS_CATALOG_SETTING,{schema:3,initialized:old.initialized,selected:old.selected,known:old.known,bindings});
  return true;
}
