/**
 * Rank Benefits v0.1.2 — GM-controlled Class Catalog.
 *
 * Discovery respects the dnd5e Compendium Browser packSourceConfiguration
 * (false means excluded) and also searches the World's Item(type=class).
 * Only Item indexes are read; no Item/Actor documents are created or changed.
 *
 * A class identity is its D&D5e system.identifier, falling back to its name.
 * This merges duplicate class definitions from different books (such as two
 * revisions of Fighter) without forcing the GM to use both sources. A World
 * setting stores the explicitly enabled identities, independent of any packs.
 */
import {ID,assertGM} from '../constants.mjs';

export const CLASS_CATALOG_SETTING='rankClassCatalog';
const BASE_PACK='dnd5e.classes';
const EMPTY=()=>({schema:1,initialized:false,selected:[],known:{}});
let discoveryCache=null;
let discoverySignature='';

function slug(value){
  return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
export function classKey(identifier,name){
  const token=slug(identifier)||slug(name);
  return token?`class:${token}`:'';
}
export function registerClassCatalogSettings(){
  game.settings.register(ID,CLASS_CATALOG_SETTING,{
    name:'Rank Benefits — Enabled Classes',scope:'world',config:false,type:Object,default:EMPTY()
  });
}
export function getSavedClassCatalog(){
  const raw=game.settings.get(ID,CLASS_CATALOG_SETTING);
  return {
    schema:1,initialized:raw?.initialized===true,
    selected:[...new Set((Array.isArray(raw?.selected)?raw.selected:[]).filter(k=>typeof k==='string'&&k.startsWith('class:')))],
    known:raw?.known&&typeof raw.known==='object'&&!Array.isArray(raw.known)?raw.known:{}
  };
}
function allowedPacks(){
  let config={};
  try{config=game.settings.get('dnd5e','packSourceConfiguration')??{};}catch(error){console.warn(`${ID} | Could not read D&D5e class source configuration`,error);}
  const packs=[...game.packs.values()].filter(p=>p.documentName==='Item' && p.visible!==false && config[p.collection]!==false);
  return packs;
}
function signature(packs){
  return packs.map(p=>p.collection).sort().join('|')+'::'+game.items.filter(i=>i.type==='class').map(i=>`${i.id}:${i.name}:${i.system?.identifier??''}`).sort().join('|');
}
function itemClass(entry,source,uuid,preferred=false,sourceId=""){
  const name=String(entry?.name??'').trim();
  const identifier=entry?.system?.identifier??entry?.system?.source?.identifier??'';
  const key=classKey(identifier,name);
  return key&&name?{key,name,identifier:String(identifier??''),uuid,source,preferred,sourceId}:null;
}
/** Read only active configured pack indexes. One broken pack does not block the rest. */
export async function discoverClasses({refresh=false}={}){
  assertGM();
  const packs=allowedPacks();
  const sig=signature(packs);
  if(discoveryCache && discoverySignature===sig && !refresh)return discoveryCache;
  const entries=new Map();
  const errors=[];
  function offer(row){
    if(!row)return;
    const old=entries.get(row.key);
    if(!old)entries.set(row.key,{...row,sources:[row.source],sourceIds:[row.sourceId]});
    else{
      if(!old.sources.includes(row.source))old.sources.push(row.source);
      if(!old.sourceIds.includes(row.sourceId))old.sourceIds.push(row.sourceId);
      // The native SRD class takes precedence as the display label when present.
      if(row.preferred&&!old.preferred){old.name=row.name;old.uuid=row.uuid;old.preferred=true;}
    }
  }
  for(const item of game.items.filter(i=>i.type==='class'))offer(itemClass(item,'World Items',item.uuid,false,'world'));
  // Bounded concurrency to avoid indexing every D&D5e Item pack at once.
  const todo=[...packs];
  const workers=Array.from({length:Math.min(4,todo.length)},async()=>{
    while(todo.length){
      const pack=todo.shift();
      // When the pack describes its dnd5e Item types, skip those with no classes.
      const packTypes=pack.metadata?.flags?.dnd5e?.types;
      if(Array.isArray(packTypes)&&packTypes.length&&!packTypes.includes('class'))continue;
      try{
        const index=await pack.getIndex({fields:['type','system.identifier']});
        for(const entry of index){
          if(entry.type!=='class')continue;
          const id=entry._id??entry.id;
          const uuid=id?`Compendium.${pack.collection}.Item.${id}`:'';
          offer(itemClass(entry,pack.title??pack.metadata?.label??pack.collection,uuid,pack.collection===BASE_PACK,pack.collection));
        }
      }catch(error){
        errors.push(pack.collection);
        console.warn(`${ID} | Could not index classes from ${pack.collection}`,error);
      }
    }
  });
  await Promise.all(workers);
  const results={entries:[...entries.values()].sort((a,b)=>a.name.localeCompare(b.name)),errors};
  discoveryCache=results;
  discoverySignature=sig;
  return results;
}

export function selectionFor(discovered,stored=getSavedClassCatalog()){
  if(stored.initialized)return new Set(stored.selected);
  // Default: only classes from the native core D&D5e class compendium.
  // Other source/homebrew classes require the GM's explicit opt-in.
  return new Set(discovered.entries.filter(e=>e.sourceIds.includes(BASE_PACK)).map(e=>e.key));
}

export async function getEnabledClasses({refresh=false}={}){
  const discovered=await discoverClasses({refresh});
  const stored=getSavedClassCatalog();
  const enabled=selectionFor(discovered,stored);
  const byKey=new Map(discovered.entries.map(c=>[c.key,c]));
  for(const key of enabled)if(!byKey.has(key) && stored.known[key]){
    const known=stored.known[key];
    byKey.set(key,{key,name:String(known.name??key),uuid:String(known.uuid??''),sources:[],unavailable:true});
  }
  return [...enabled].map(key=>byKey.get(key)).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name));
}

export async function getClassCatalogOptions({refresh=false}={}){
  const discovered=await discoverClasses({refresh});
  const stored=getSavedClassCatalog();
  const selected=selectionFor(discovered,stored);
  const entries=[...discovered.entries];
  const byKey=new Set(entries.map(e=>e.key));
  for(const key of stored.selected)if(!byKey.has(key)){
    const known=stored.known[key]??{};
    entries.push({key,name:String(known.name??key),uuid:String(known.uuid??''),sources:[],unavailable:true});
  }
  entries.sort((a,b)=>a.name.localeCompare(b.name));
  return {entries:entries.map(e=>({...e,enabled:selected.has(e.key),sourceLabel:e.sources?.join(' · ')||'Source unavailable'})),errors:discovered.errors,initialized:stored.initialized};
}

export async function saveClassCatalog(selectedKeys,entries){
  assertGM();
  const known={...getSavedClassCatalog().known};
  const validKeys=new Set(entries.map(e=>e.key));
  const selected=[...new Set(selectedKeys)].filter(key=>validKeys.has(key));
  for(const item of entries)known[item.key]={name:item.name,uuid:item.uuid};
  await game.settings.set(ID,CLASS_CATALOG_SETTING,{schema:1,initialized:true,selected,known});
  return selected.length;
}
