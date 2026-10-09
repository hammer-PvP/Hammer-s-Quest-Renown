import {ID,factions,rankFor,DEFAULT_RANKS} from '../constants.mjs';
import {reputationOf,historyFor} from '../services/reputation.mjs';

const TEMPLATE=`modules/${ID}/templates/reputation-tab.hbs`;
const ICON=`modules/${ID}/assets/book-feather.svg`;
let installed=false;

function maximumFor(faction) {
  const thresholds=faction.getFlag(ID,'ranks') ?? DEFAULT_RANKS;
  return Math.max(0,...thresholds.map(r=>Number(r.min)).filter(Number.isFinite));
}
function recorded(actor,uuid){
  return !!actor && historyFor(actor).some(row=>row.factionUuid===uuid);
}
function scoreFor(actor,faction){
  if(!recorded(actor,faction.uuid))return null;
  const score=reputationOf(actor,faction.uuid);
  return {rank:rankFor(faction,score),current:score,max:maximumFor(faction)};
}
function relatedGroup(actor){
  if(actor?.type!=='character')return null;
  const groups=game.actors.filter(group=>group.type==='group' &&
    (game.user.isGM || group.testUserPermission(game.user,'OBSERVER')) &&
    (group.system?.members??[]).some(member=>(member.actor?.id??member.actor)===actor.id));
  // Only the designated Party's renown is shown when present: never merge balances from separate groups.
  const party=game.actors.party;
  return groups.find(group=>group.id===party?.id) ?? groups.sort((a,b)=>a.name.localeCompare(b.name))[0] ?? null;
}
function rowsFor(actor){
  const group=relatedGroup(actor);
  const isGroup=actor?.type==='group';
  return factions().flatMap(faction=>{
    const personal=isGroup?null:scoreFor(actor,faction);
    const shared=scoreFor(isGroup?actor:group,faction);
    if(!personal&&!shared)return [];
    return [{name:faction.name,uuid:faction.uuid,personal,shared,groupName:group?.name??''}];
  });
}

/** Scope this extension exclusively to the native D&D5e 6.x Character/Group sheets. */
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
  console.info(`${ID} | Native Character/Group Reputation tabs installed (compact 0.0.3).`);
}
