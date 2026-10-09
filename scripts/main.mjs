import {ID,isGM,report,esc} from "./constants.mjs";
import {roots,reconcileAccess} from "./services/documents.mjs";
import {FactionApp} from "./apps/faction-app.mjs";
import {QuestApp} from "./apps/quest-app.mjs";
import {ReputationApp} from "./apps/reputation-app.mjs";
import {QuestManagerApp} from "./apps/quest-manager-app.mjs";
import {QuestLifecycleApp} from "./apps/quest-lifecycle-app.mjs";
import {installReputationTabs} from "./sheets/reputation-tab.mjs";

function startFaction(doc=null){ if(!isGM())return;new FactionApp(doc).render(true); }
function startQuest(doc=null){ if(!isGM())return;new QuestApp(doc).render(true); }
function startQuestManager(){if(!isGM())return;new QuestManagerApp().render(true);}
function startQuestLifecycle(doc,mode='giving'){if(!isGM())return;new QuestLifecycleApp(doc,mode).render(true);}
function startReputation(actor=null){new ReputationApp(actor).render(true);}
function addDirectoryButtons(app,html){
  if(!isGM())return;
  const root=html?.[0]??html??app?.element;
  if(!(root instanceof HTMLElement) || root.querySelector('.hqr-directory-tools'))return;
  const host=root.querySelector('.directory-header .header-actions') ?? root.querySelector('.directory-header') ?? root.querySelector('header');
  if(!host)return;
  const row=document.createElement('div');row.className='hqr-directory-tools';
  const buttons=[['fa-scroll','New Quest',()=>startQuest()],['fa-list-check','Quest Manager',()=>startQuestManager()],['fa-shield-halved','Factions',()=>startFaction()],['fa-book-open','Renown',()=>startReputation()]];
  for(const [icon,label,cb] of buttons){const btn=document.createElement('button');btn.type='button';btn.className='hqr-directory-button';btn.innerHTML=label==='Renown' ? `<img class="hqr-directory-identity" src="modules/${ID}/assets/book-feather.svg" alt=""> ${label}` : `<i class="fa-solid ${icon}"></i> ${label}`;btn.title=`Hammer's Quest & Renown — ${label}`;btn.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();cb();});row.append(btn);}
  host.append(row);
}
function attachItemTooltips(root){
  if(!(root instanceof HTMLElement) || root.dataset.hqrTooltips==='true')return;
  root.dataset.hqrTooltips='true';
  let current=null;let popup=null;
  const hide=()=>{popup?.remove();popup=null;current=null;};
  root.addEventListener('mouseover',async event=>{
    const link=event.target.closest?.('.hqr-journal a.content-link[data-uuid]');
    if(!link || link===current)return;
    hide();current=link;
    const uuid=link.dataset.uuid;
    try{
      const item=await fromUuid(uuid);
      if(current!==link || item?.documentName!=='Item')return;
      // A GM can see the entire document; a player only sees documents already accessible to that client.
      const details=String(item.system?.description?.value??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,500);
      popup=document.createElement('div');popup.className='hqr-reward-tooltip';
      const image=item.img?`<img src="${esc(item.img)}" alt="">`:'';
      popup.innerHTML=`${image}<div><strong>${esc(item.name)}</strong><small>${esc(item.type)}</small>${details?`<p>${esc(details)}</p>`:''}</div>`;
      document.body.append(popup);
      const rect=link.getBoundingClientRect();
      popup.style.left=`${Math.max(8,Math.min(window.innerWidth-330,rect.left))}px`;
      popup.style.top=`${Math.max(8,Math.min(window.innerHeight-190,rect.bottom+7))}px`;
    }catch(error){console.debug(`${ID} | Item tooltip unavailable`,error);}
  });
  root.addEventListener('mouseout',event=>{
    if(current && event.target.closest?.('.hqr-journal a.content-link[data-uuid]')===current && !current.contains(event.relatedTarget))hide();
  });
  root.addEventListener('mouseleave',hide);
}
function addJournalSheetButton(app,html){
  const journal=app?.document;
  if(journal?.documentName!=="JournalEntry"||!["quest","faction"].includes(journal.getFlag(ID,'kind')))return;
  const root=html?.[0]??html??app.element;
  if(!(root instanceof HTMLElement))return;
  attachItemTooltips(root);
  if(!isGM() || root.querySelector('.hqr-edit-journal'))return;
  const host=root.querySelector('.window-header .window-title')??root.querySelector('.window-header');
  if(!host)return;
  const button=document.createElement('button');button.type='button';button.className='hqr-edit-journal';button.innerHTML='<i class="fa-solid fa-pen-to-square"></i> Edit Quest / Faction';
  button.addEventListener('click',event=>{event.preventDefault();journal.getFlag(ID,'kind')==='quest'?startQuest(journal):startFaction(journal);});
  host.after(button);
}
function isDndActorSheet(app){
  const actor=app?.actor??app?.document;
  const sheetClass=foundry.applications.sheets?.ActorSheetV2;
  return !!(actor && ['group','character'].includes(actor.type) && app?.document===actor && (sheetClass ? app instanceof sheetClass : /ActorSheet/.test(app?.constructor?.name??'')));
}
Hooks.once('init',()=>{
  console.info(`${ID} | Initializing v0.0.4`);
});
Hooks.once('ready',async()=>{
  if(game.system.id!=="dnd5e"){ui.notifications.warn("Hammer's Quest & Renown is designed for D&D5e 6.x.");return;}
  installReputationTabs();
  installReputationClickHandler();
  game.modules.get(ID).api={openFactions:startFaction,newQuest:()=>startQuest(),editQuest:startQuest,
    openQuestManager:startQuestManager,openQuestLifecycle:startQuestLifecycle,openReputation:startReputation,reconcileAccess};
  if(!isGM())return;
  try {await roots();await reconcileAccess();}catch(error){report(error,'Initialization failed');}
});

// A single delegated listener survives D&D5e partial tab renders, F5 and any sheet redraw.
// Actor id is explicitly rendered by our own template; never rely on timing of renderApplicationV2.
let reputationClickInstalled=false;
function installReputationClickHandler(){
  if(reputationClickInstalled)return;
  reputationClickInstalled=true;
  document.addEventListener('click',event=>{
    const button=event.target instanceof Element ? event.target.closest('button.hqr-open-reputation[data-hqr-actor-id]') : null;
    if(!button)return;
    const actor=game.actors.get(button.dataset.hqrActorId);
    if(!actor || !['character','group'].includes(actor.type))return;
    if(!game.user.isGM && !actor.testUserPermission(game.user,'OBSERVER'))return;
    event.preventDefault();event.stopPropagation();
    startReputation(actor);
  },true);
}

// Native Journal Directory, including the V14 ApplicationV2 sidebar.
Hooks.on('renderJournalDirectory',(app,html)=>addDirectoryButtons(app,html));
Hooks.on('renderApplicationV2',(app,element)=>{
  if(app?.constructor?.name==='JournalDirectory')addDirectoryButtons(app,element);
  if(app?.document?.documentName==='JournalEntry')addJournalSheetButton(app,element);
});
Hooks.on('renderJournalSheet',(app,html)=>addJournalSheetButton(app,html));
Hooks.on('getHeaderControlsApplicationV2',(app,controls)=>{
  if(isDndActorSheet(app)){
    const actor=app.actor??app.document;
    if(game.user.isGM || actor.testUserPermission(game.user,'OBSERVER')){
      controls.push({action:'hqrOpenReputation',label:'Reputation',icon:'fa-solid fa-book-open',visible:true,onClick:()=>startReputation(actor)});
    }
  }
  if(isGM() && app?.document?.documentName==='JournalEntry'){
    const journal=app.document;
    if(['faction','quest'].includes(journal.getFlag(ID,'kind'))){
      controls.push({action:'hqrEditJournal',label:journal.getFlag(ID,'kind')==='quest'?'Edit Quest':'Edit Faction',icon:'fa-solid fa-pen-to-square',visible:true,onClick:()=>journal.getFlag(ID,'kind')==='quest'?startQuest(journal):startFaction(journal)});
    }
  }
});
// Native permissions can be manually modified by a GM. Re-apply the Observer-only contract.
let checkQueued=false;
function queuePermissions(){
  if(!isGM()||checkQueued)return;checkQueued=true;
  queueMicrotask(async()=>{checkQueued=false;try{await reconcileAccess();}catch(e){console.error(`${ID} | permission check`,e);}});
}
Hooks.on('updateActor',(actor,change)=>{
  if(change.ownership||change.system?.members||change.flags?.[ID]?.ledger)queuePermissions();
});
Hooks.on('createUser',queuePermissions);
Hooks.on('updateUser',queuePermissions);
Hooks.on('updateJournalEntry',(journal,change)=>{
  if(['quest','faction'].includes(journal.getFlag(ID,'kind')) && (change.ownership||change.flags?.[ID]))queuePermissions();
});

Hooks.on('updateJournalEntryPage',page=>{if(page.getFlag(ID,'gmOnly'))queuePermissions();});
