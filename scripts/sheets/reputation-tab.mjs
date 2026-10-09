import {ID,factions,rankFor,DEFAULT_RANKS} from '../constants.mjs';
import {reputationOf,historyFor} from '../services/reputation.mjs';

const TEMPLATE=`modules/${ID}/templates/reputation-tab.hbs`;
const ICON=`modules/${ID}/assets/book-feather.svg`;
let installed=false;
function maximumFor(faction){
  const thresholds=faction.getFlag(ID,'ranks')??DEFAULT_RANKS;
  return Math.max(0,...thresholds.map(r=>Number(r.min)).filter(Number.isFinite));
}
function rowsFor(actor){
  const ledger=historyFor(actor);
  return factions().filter(f=>ledger.some(entry=>entry.factionUuid===f.uuid)).map(f=>{
    const value=reputationOf(actor,f.uuid);
    return {name:f.name,uuid:f.uuid,rank:rankFor(f,value),current:value,max:maximumFor(f)};
  });
}
/** Native D&D5e 6.0.6 Character and Group sheets: each Actor shows ONLY its own ledger. */
export function installReputationTabs(){
  if(installed)return;
  const target=game.dnd5e?.applications?.actor;
  if(!target?.CharacterActorSheet||!target?.GroupActorSheet){
    console.warn(`${ID} | Native D&D5e sheet classes unavailable; Reputation header control remains accessible.`);
    return;
  }
  installed=true;
  for(const sheetClass of [target.CharacterActorSheet,target.GroupActorSheet]){
    if(!sheetClass.TABS.some(tab=>tab.tab==='reputation')){
      const tab={tab:'reputation',label:'Reputation',icon:'fa-solid fa-book-open'};
      if(sheetClass===target.CharacterActorSheet){delete tab.icon;tab.svg=ICON;}
      else tab.icon='hqr-book-feather-tab-icon';
      sheetClass.TABS=[...sheetClass.TABS,tab];
    }
    sheetClass.PARTS={...sheetClass.PARTS,reputation:{container:{classes:['tab-body'],id:'tabs'},template:TEMPLATE,scrollable:['']}};
  }
  Hooks.on('dnd5e.prepareSheetContext',(app,partId,context)=>{
    if(partId!=='reputation')return;
    if(![target.CharacterActorSheet,target.GroupActorSheet].some(klass=>app instanceof klass))return;
    const actor=app.actor??app.document;
    context.hqr={actorId:actor.id,isGM:game.user.isGM,isGroup:actor.type==='group',rows:rowsFor(actor)};
  });
  console.info(`${ID} | Native Character/Group Reputation tabs installed (Actor-only v0.0.5).`);
}
