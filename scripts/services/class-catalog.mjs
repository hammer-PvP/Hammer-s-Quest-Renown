/**
 * Rank Benefits — Class Sources (v0.1.7).
 * A logical class slot (class:fighter) is distinct from its selected definition.
 * The definition binding records the *exact* source pack and class Item UUID;
 * two editions never silently substitute for one another. No grants are made.
 * All previously configured logical slot keys and class selections survive.
 */
import {ID,assertGM} from '../constants.mjs';

export const CLASS_CATALOG_SETTING='rankClassCatalog';
export const CLASS_SOURCES_SETTING='rankClassSources';
const BASE_PACK='dnd5e.classes';
const SOURCE_EMPTY=()=>({schema:1,initialized:false,selected:[]});
const CATALOG_EMPTY=()=>({schema:2,initialized:false,selected:[],known:{},bindings:{}});
let discoveryCache=null, discoverySignature='';
const safeText=v=>String(v??'').trim();
function slug(value){return safeText(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
export function classKey(identifier,name){const token=slug(identifier)||slug(name);return token?`class:${token}`:'';}
export function registerClassCatalogSettings(){
  game.settings.register(ID,CLASS_CATALOG_SETTING,{name:'Rank Benefits — Enabled Classes',scope:'world',config:false,type:Object,default:CATALOG_EMPTY()});
  game.settings.register(ID,CLASS_SOURCES_SETTING,{name:'Rank Benefits — Class Sources',scope:'world',config:false,type:Object,default:SOURCE_EMPTY()});
}
export function getSavedClassCatalog(){
  const raw=game.settings.get(ID,CLASS_CATALOG_SETTING)??{};
  const bindings=raw.bindings && typeof raw.bindings==='object'&&!Array.isArray(raw.bindings)?raw.bindings:{};
  return {schema:Number(raw.schema)||1,initialized:raw.initialized===true,
    selected:[...new Set((Array.isArray(raw.selected)?raw.selected:[]).filter(x=>typeof x==='string'&&x.startsWith('class:')))],
    known:raw.known&&typeof raw.known==='object'&&!Array.isArray(raw.known)?raw.known:{},bindings};
}
export function getSavedClassSources(){
  const raw=game.settings.get(ID,CLASS_SOURCES_SETTING)??{};
  return {schema:1,initialized:raw.initialized===true,
    selected:[...new Set((Array.isArray(raw.selected)?raw.selected:[]).filter(x=>typeof x==='string'&&x))]};
}
function packConfig(){try{return game.settings.get('dnd5e','packSourceConfiguration')??{};}catch(e){console.warn(`${ID} | Cannot read D&D5e pack sources`,e);return {};}}
function allowedPacks(){
  const conf=packConfig();
  return [...game.packs.values()].filter(p=>p.documentName==='Item'&&p.visible!==false&&conf[p.collection]!==false);
}
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
  const source=entry?.system?.source;
  if(!source)return '';
  if(typeof source==='string')return formatClassSource(source);
  if(typeof source!=='object')return '';
  for(const field of [source.book,source.custom,source.title]){const value=formatClassSource(field,source.rules??source.revision??'');if(value)return value;}
  return '';
}
function sourceLabel(entry,pack){return documentSource(entry)||formatClassSource(pack?.metadata?.flags?.dnd5e?.sourceBook)||safeText(pack?.title??pack?.metadata?.label??pack?.collection)||'Unknown source';}
function editionOf(entry,source){
  const hint=`${safeText(entry?.system?.source?.rules)} ${safeText(source)}`;
  return /\b2024\b|\b5\.2\b/i.test(hint)?'2024':/\b2014\b|\b5\.1\b/i.test(hint)?'2014':'';
}
function variant(entry,sourceId,uuid,packTitle='',packBook=''){
  const name=safeText(entry?.name),identifier=safeText(entry?.system?.identifier)||slug(name),key=classKey(identifier,name);
  if(!key||!name||!uuid)return null;
  const source=sourceLabel(entry,{title:packTitle,metadata:{flags:{dnd5e:{sourceBook:packBook}}}});
  return {key,name,identifier,sourceId,uuid,source,edition:editionOf(entry,source),packTitle};
}
function sortVariants(a,b){return a.source.localeCompare(b.source)||a.sourceId.localeCompare(b.sourceId)||a.uuid.localeCompare(b.uuid);}
/** Discover class definitions individually. Identical identifiers from other
 * packs/editions are kept as separate options, not merged or silently chosen.
 */
export async function discoverClasses({refresh=false}={}){
  assertGM();const packs=allowedPacks(),sig=signature(packs);
  if(!refresh&&discoveryCache&&discoverySignature===sig)return discoveryCache;
  const groups=new Map(),sources=new Map(),errors=[];
  const offer=row=>{if(!row)return;
    let group=groups.get(row.key);if(!group){group={key:row.key,name:row.name,identifier:row.identifier,variants:[]};groups.set(row.key,group);}
    if(!group.variants.some(v=>v.uuid===row.uuid))group.variants.push(row);
    const source=sources.get(row.sourceId);
    if(source){source.count++;if(!source.books.includes(row.source))source.books.push(row.source);}
    else sources.set(row.sourceId,{id:row.sourceId,name:row.sourceId==='world'?'World Items':(row.packTitle||row.sourceId),count:1,books:[row.source],isWorld:row.sourceId==='world'});
  };
  for(const item of game.items.filter(i=>i.type==='class'))offer(variant(item,'world',item.uuid,'World Items',''));
  const todo=[...packs];
  await Promise.all(Array.from({length:Math.min(todo.length,4)},async()=>{
    while(todo.length){const pack=todo.shift(),types=pack.metadata?.flags?.dnd5e?.types;
      if(Array.isArray(types)&&types.length&&!types.includes('class'))continue;
      try{
        const idx=await pack.getIndex({fields:['type','system.identifier','system.source','flags.dnd5e.sourceId']});
        for(const item of idx){if(item.type!=='class')continue;
          const id=item._id??item.id;
          if(!id)continue;
          offer(variant(item,pack.collection,`Compendium.${pack.collection}.Item.${id}`,safeText(pack.title??pack.metadata?.label),pack.metadata?.flags?.dnd5e?.sourceBook));
        }
      }catch(error){errors.push(pack.collection);console.warn(`${ID} | Could not index class source ${pack.collection}`,error);}
    }
  }));
  const entries=[...groups.values()].map(g=>({...g,variants:g.variants.sort(sortVariants)})).sort((a,b)=>a.name.localeCompare(b.name));
  const sourceOptions=[...sources.values()].map(s=>({...s,books:s.books.sort(),bookLabel:s.books.join(' · ')})).sort((a,b)=>a.name.localeCompare(b.name));
  discoveryCache={entries,sources:sourceOptions,errors};discoverySignature=sig;return discoveryCache;
}
function savedSourceSet(discovered,stored=getSavedClassSources(),catalog=getSavedClassCatalog()){
  if(stored.initialized)return new Set(stored.selected);
  // Compatibility default: preserve the pack previously associated with
  // selected class UUIDs, instead of silently changing the 2014/2024 rules.
  const ids=new Set();
  for(const key of catalog.selected){
    const item=catalog.bindings[key]??catalog.known[key];
    const uuid=safeText(item?.uuid);
    for(const src of discovered.sources)if(src.id==='world'?(uuid.startsWith('Item.')):uuid.startsWith(`Compendium.${src.id}.Item.`))ids.add(src.id);
  }
  if(ids.size)return ids;
  const sources=new Set(discovered.sources.map(s=>s.id));
  return new Set([sources.has(BASE_PACK)?BASE_PACK:(sources.has('dnd5e.classes24')?'dnd5e.classes24':'')].filter(Boolean));
}
function matchBinding(variants,binding){
  if(!binding)return null;
  return variants.find(v=>v.uuid===binding.uuid && (!binding.sourceId||v.sourceId===binding.sourceId))??null;
}
function fromVariants(group,active,stored){
  const variants=group.variants.filter(v=>active.has(v.sourceId));
  const binding=matchBinding(variants,stored.bindings[group.key]);
  // For v0.1.6 legacy selections, the original UUID acts as a migration hint.
  const legacy=matchBinding(variants,stored.known[group.key]);
  // A previously pinned Item must NEVER silently rebind to another edition
  // when its pack is disabled, removed or unselected.
  const pinned=!!(stored.bindings[group.key]?.uuid||stored.known[group.key]?.uuid);
  const chosen=binding??legacy??(!pinned&&variants.length===1?variants[0]:null);
  return {variants,chosen,ambiguous:variants.length>1&&!chosen};
}
export function selectionFor(discovered,stored=getSavedClassCatalog()){
  if(stored.initialized)return new Set(stored.selected);
  return new Set(discovered.entries.filter(e=>e.variants.some(v=>v.sourceId===BASE_PACK)).map(e=>e.key));
}
/** Context for both the Module Settings screen and legacy Class Catalog modal. */
export async function getClassCatalogOptions({refresh=false}={}){
  const discovered=await discoverClasses({refresh}),stored=getSavedClassCatalog(),sourceStore=getSavedClassSources();
  const active=savedSourceSet(discovered,sourceStore,stored),enabled=selectionFor(discovered,stored);
  const result=[];
  for(const group of discovered.entries){
    const data=fromVariants(group,active,stored);
    result.push({...group,enabled:enabled.has(group.key),unavailable:data.variants.length===0,
      sourceLabel:data.chosen?.source??(data.ambiguous?'Select class definition':(data.variants.length?'Select definition':'Source unavailable')),
      selectedUuid:data.chosen?.uuid??'',ambiguous:data.ambiguous,
      pinnedUnavailable:!data.chosen&&!!(stored.bindings[group.key]?.uuid||stored.known[group.key]?.uuid),
      definitions:group.variants.map(v=>({...v,selected:v.uuid===data.chosen?.uuid}))});
  }
  for(const key of enabled)if(!result.some(e=>e.key===key)){
    const last=stored.known[key]??{};
    result.push({key,name:safeText(last.name)||key,enabled:true,unavailable:true,sourceLabel:'Previously selected · Source unavailable',selectedUuid:'',definitions:[]});
  }
  result.sort((a,b)=>a.name.localeCompare(b.name));
  return {entries:result,sources:discovered.sources.map(s=>({...s,enabled:active.has(s.id)})),
    errors:discovered.errors,initialized:stored.initialized,sourcesInitialized:sourceStore.initialized};
}
/** Source-bound identity is kept separate from the legacy class slot key.
 * No Actor grants are made here; unresolved definitions remain unavailable.
 */
export async function getEnabledClasses({refresh=false}={}){
  const data=await getClassCatalogOptions({refresh});const stored=getSavedClassCatalog();
  return data.entries.filter(e=>e.enabled).map(e=>{
    const actual=e.definitions?.find(v=>v.uuid===e.selectedUuid);
    const known=stored.known[e.key]??{};
    return {key:e.key,name:e.name,uuid:actual?.uuid??safeText(known.uuid),
      sourceId:actual?.sourceId??'',source:actual?.source??'',edition:actual?.edition??'',
      unavailable:!actual,ambiguous:e.ambiguous};
  });
}
/** Validate all draft choices BEFORE writing either World setting. The
 * source setting is then written first; a failed second write is retryable.
 */
export async function validateClassCatalogDraft(selectedKeys,entries,{sourceIds=null,bindings=null}={}){
  assertGM();const discovered=await discoverClasses(),old=getSavedClassCatalog();
  const availableSources=new Set(discovered.sources.map(s=>s.id));
  const allowed=sourceIds===null?savedSourceSet(discovered):new Set(sourceIds);
  for(const id of allowed)if(!availableSources.has(id))throw new Error(`Unknown or disabled class source: ${id}`);
  const known={...old.known},newBindings={...old.bindings};
  const byKey=new Map(entries.map(e=>[e.key,e]));
  const selected=[...new Set(selectedKeys)].filter(k=>byKey.has(k));
  for(const key of selected){
    const entry=byKey.get(key);
    const group=discovered.entries.find(e=>e.key===key);
    const variants=(group?.variants??[]).filter(v=>allowed.has(v.sourceId));
    const requested=safeText(bindings?.[key]??entry.selectedUuid);
    let chosen=variants.find(v=>v.uuid===requested);
    // A legacy definition pinned to another UUID must be explicitly changed;
    // only first-time classes may resolve a single candidate automatically.
    if(!chosen && variants.length===1 && !(old.bindings[key]?.uuid||old.known[key]?.uuid))chosen=variants[0];
    if(!chosen&&variants.length)throw new Error(`Choose a specific source for ${entry.name}; the previous class definition cannot be substituted automatically.`);
    // Previously enabled but currently missing classes remain selected and
    // retain their last-known binding; never replace by another source.
    if(!chosen&&variants.length===0 && !(old.selected.includes(key)&&!group))throw new Error(`No permitted source found for ${entry.name}.`);
    if(chosen){newBindings[key]={sourceId:chosen.sourceId,uuid:chosen.uuid,source:chosen.source,edition:chosen.edition,identifier:chosen.identifier};known[key]={name:entry.name,uuid:chosen.uuid,sourceId:chosen.sourceId,source:chosen.source};}
    else known[key]??={name:entry.name,uuid:''};
  }
  return {selected,known,bindings:newBindings,allowed:[...allowed]};
}
export async function saveClassCatalog(selectedKeys,entries,options={}){
  const {selected,known,bindings,allowed}=await validateClassCatalogDraft(selectedKeys,entries,options);
  if(options.sourceIds!==null && options.sourceIds!==undefined)
    await game.settings.set(ID,CLASS_SOURCES_SETTING,{schema:1,initialized:true,selected:allowed});
  await game.settings.set(ID,CLASS_CATALOG_SETTING,{schema:2,initialized:true,selected,known,bindings});
  return selected.length;
}

/** Versioned additive conversion of v0.1.6 World class selections.
 * It never attempts to resolve ambiguous books or rewrites Faction records.
 */
export async function migrateLegacyClassCatalog(){
  assertGM();
  const old=getSavedClassCatalog();
  if(old.schema>=2)return false;
  const bindings={...old.bindings};
  for(const key of old.selected){
    if(bindings[key]?.uuid)continue;
    const known=old.known[key];const uuid=safeText(known?.uuid);
    if(!uuid)continue;
    let sourceId=safeText(known?.sourceId);
    if(!sourceId){const match=/^Compendium\.([^.]+\.[^.]+)\.Item\./.exec(uuid);if(match)sourceId=match[1];}
    if(!sourceId&&uuid.startsWith('Item.'))sourceId='world';
    if(sourceId)bindings[key]={sourceId,uuid,source:safeText(known?.source),identifier:key.slice(6)};
  }
  await game.settings.set(ID,CLASS_CATALOG_SETTING,{schema:2,initialized:old.initialized,selected:old.selected,known:old.known,bindings});
  return true;
}
