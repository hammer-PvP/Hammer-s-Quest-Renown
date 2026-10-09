import {ID,factions,rankFor} from '../constants.mjs';
import {reputationOf,historyFor} from '../services/reputation.mjs';
const TEMPLATE=`modules/${ID}/templates/reputation-tab.hbs`;
let installed=false;
function balances(actor){
  return factions().filter(f=>historyFor(actor).some(row=>row.factionUuid===f.uuid)).map(f=>{
    const score=reputationOf(actor,f.uuid);
    return {name:f.name,uuid:f.uuid,score,rank:rankFor(f,score)};
  });
}
function relatedGroups(actor){
  if(actor?.type!=='character')return [];
  return game.actors.filter(group=>group.type==='group' && group.testUserPermission(game.user,'OBSERVER') &&
    (group.system?.members??[]).some(member=>(member.actor?.id??member.actor)===actor.id));
}
/** Only native D&D5e 6.0.6 Character and Group sheets are extended. */
export function installReputationTabs(){
  if(installed)return;
  const target=game.dnd5e?.applications?.actor;
  if(!target?.CharacterActorSheet||!target?.GroupActorSheet){
    console.warn(`${ID} | Native D&D5e ActorSheet classes unavailable; Reputation header control remains accessible.`);
    return;
  }
  installed=true;
  for(const sheetClass of [target.CharacterActorSheet,target.GroupActorSheet]){
    if(!sheetClass.TABS.some(t=>t.tab==='reputation'))sheetClass.TABS=[...sheetClass.TABS,{tab:'reputation',label:'Reputation',icon:'fa-solid fa-award'}];
    sheetClass.PARTS={...sheetClass.PARTS,reputation:{container:{classes:['tab-body'],id:'tabs'},template:TEMPLATE,scrollable:['']}};
  }
  Hooks.on('dnd5e.prepareSheetContext',(app,partId,context)=>{
    if(partId!=='reputation')return;
    if(![target.CharacterActorSheet,target.GroupActorSheet].some(klass=>app instanceof klass))return;
    const actor=app.actor??app.document;
    context.hqr={
      actorName:actor.name,isGM:game.user.isGM,isGroup:actor.type==='group',personal:balances(actor),
      shared:relatedGroups(actor).flatMap(group=>balances(group).map(row=>({...row,groupName:group.name}))),
      hasPermission:game.user.isGM||actor.testUserPermission(game.user,'OBSERVER')
    };
  });
  console.info(`${ID} | Native Character/Group Reputation tabs installed.`);
}
