/**
 * Rank Benefits schema v1 (module dataVersion 5).
 * Foundation ONLY: stores named ranks and empty General/Class Specific benefit
 * blocks. No grant operations, document mutations or Actor flags in v0.1.0.
 *
 * Existing rank names, thresholds, ordering and unknown metadata survive.
 * Blocks have stable IDs so future source items and individual class slots
 * can be attached without changing the identity of previously saved data.
 */
import {ID,DEFAULT_RANKS,assertGM} from "../constants.mjs";

export const BENEFIT_TYPES=Object.freeze(["general","classSpecific"]);
const newId=()=>foundry.utils.randomID();

export function normalizeFactionRanks(rows=DEFAULT_RANKS){
  const source=Array.isArray(rows)&&rows.length?rows:DEFAULT_RANKS;
  const usedRanks=new Set();
  return source.filter(r=>String(r?.name??"").trim()&&Number.isFinite(Number(r.min))).map(r=>{
    let id=String(r.id??"").trim();
    if(!id||usedRanks.has(id))id=newId();
    usedRanks.add(id);
    const usedBlocks=new Set();
    const benefits=(Array.isArray(r.benefits)?r.benefits:[]).filter(b=>BENEFIT_TYPES.includes(b?.type)).map(b=>{
      let bid=String(b.id??"").trim();
      if(!bid||usedBlocks.has(bid))bid=newId();
      usedBlocks.add(bid);
      return {
        ...b,
        id:bid,
        type:b.type,
        items:Array.isArray(b.items)?b.items:[],
        classes:b.classes && typeof b.classes==="object" && !Array.isArray(b.classes)?b.classes:{}
      };
    });
    return {...r,id,name:String(r.name).trim(),min:Number(r.min),benefits};
  }).sort((a,b)=>a.min-b.min);
}

/** Additive and retry-safe; only Faction Journal flags are updated. */
export async function migrateFactionRankBenefits(){
  assertGM();
  let updated=0;
  for(const journal of game.journal.filter(j=>j.getFlag(ID,"kind")==="faction")){
    const current=journal.getFlag(ID,"ranks");
    const normalized=normalizeFactionRanks(current);
    if(JSON.stringify(normalized)!==JSON.stringify(current)){
      await journal.setFlag(ID,"ranks",normalized);
      updated++;
    }
  }
  return updated;
}

export function newBenefitBlock(type){
  if(!BENEFIT_TYPES.includes(type))throw new Error("Unsupported benefit block type.");
  return {id:newId(),type,items:[],classes:{}};
}
