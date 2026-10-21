import {normalizeFactionRanks} from "./rank-benefits.mjs";
import {DEFAULT_FOLDER_NAMES,FOLDER_FIELDS,getFolderColors,getFolderNames,getFolderIds,saveFolderIds,validateFolderNames} from "./folder-settings.mjs";
import {ID,FOLDER_FACTIONS,FOLDER_QUESTS,LEGACY_FOLDER_FACTIONS,LEGACY_FOLDER_QUESTS,DEFAULT_RANKS,assertGM,esc,htmlText,factions,ownerUsers,eligible,groupMembers,CURRENCIES} from "../constants.mjs";

export const COLORS = Object.freeze({questRoot:"#ab960d",questCategory:"#776809",factionRoot:"#890b1e"}); // legacy defaults, kept for API compatibility
export const GM_ONLY_FOLDER = "GM Only";
export const ACTIVE_FOLDER = "Active";
export const FINISHED_FOLDER = "Finished";
const LEGACY_INACTIVE_FOLDER = "Inativas";
const OWN_NONE = CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;
const OWN_OBSERVER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
let syncing = false;
const pageText = (name, html, gmOnly=false) => ({
  name, type:"text", text:{format:1, content:html},
  ownership:{default:gmOnly ? OWN_NONE : -1},
  flags:{[ID]:{gmOnly}}
});
function docPage(doc, isGMPage) { return doc.pages.find(p=>Boolean(p.getFlag(ID,"gmOnly"))===isGMPage); }
export function getFaction(uuid) { return factions().find(f=>f.uuid===uuid) ?? null; }
/** An empty legacy owner and a deliberately independent Quest are equivalent.
 * A nonempty but unresolved UUID is NOT independent (it is a broken link).
 */
export function questOwnerUuid(value){const uuid=String(value??'').trim();return uuid||null;}
export function questFactionLabel(value){
  const uuid=questOwnerUuid(value);
  return uuid?(getFaction(uuid)?.name??'Missing Faction'):'No Faction';
}
const directFolder = (name,parent=null) => game.folders.find(f=>f.type==="JournalEntry" && f.name===name && (f.folder?.id??null)===(parent?.id??null));
const parentId=parent=>parent?.id??null;
const matchesParent=(folder,parent)=>folder?.type==="JournalEntry" && (folder.folder?.id??null)===parentId(parent);
/** Locate a managed Folder by immutable ID/role first, never by its current visible name. */
function findManaged(role,parent=null){
  const byId=game.folders.get(getFolderIds()[role]);
  if(matchesParent(byId,parent))return byId;
  const byRole=game.folders.find(f=>matchesParent(f,parent) && f.getFlag?.(ID,"managedFolderRole")===role);
  if(byRole)return byRole;
  const names=getFolderNames();
  for(const name of [names[role],DEFAULT_FOLDER_NAMES[role],
    role==="factionRoot"?LEGACY_FOLDER_FACTIONS:null,
    role==="questRoot"?LEGACY_FOLDER_QUESTS:null].filter(Boolean)){
    const candidate=directFolder(name,parent);
    // Never adopt a folder explicitly owned by another logical role.
    if(candidate && !candidate.getFlag?.(ID,"managedFolderRole"))return candidate;
  }
  return null;
}
/** Retained as a generic exported helper for older integrations. */
export async function ensureFolder(name,parent=null,color=null){
  assertGM();
  const existing=directFolder(name,parent);
  if(existing){if(color && String(existing.color??"").toLowerCase()!==color)await existing.update({color});return existing;}
  return Folder.create({name,type:"JournalEntry",folder:parentId(parent),...(color?{color}:{})});
}
async function ensureManaged(role,parent=null){
  assertGM();
  const names=getFolderNames(),colors=getFolderColors();
  const wanted=names[role],color=colors[role];
  let folder=findManaged(role,parent);
  if(!folder){
    folder=await Folder.create({name:wanted,type:"JournalEntry",folder:parentId(parent),color,
      flags:{[ID]:{managedFolderRole:role}}});
  }else{
    const changes={};
    if(folder.name!==wanted)changes.name=wanted;
    if(String(folder.color??"").toLowerCase()!==color)changes.color=color;
    if(folder.getFlag?.(ID,"managedFolderRole")!==role)changes[`flags.${ID}.managedFolderRole`]=role;
    if(Object.keys(changes).length)await folder.update(changes);
  }
  if(getFolderIds()[role]!==folder.id)await saveFolderIds({[role]:folder.id});
  return folder;
}
/** Detect collisions with unrelated folders before persisting any custom names. */
export function validateManagedFolderNames(next){
  const names=validateFolderNames(next);
  const rootF=findManaged("factionRoot"),rootQ=findManaged("questRoot");
  const ours=new Set([rootF?.id,rootQ?.id,
    ...["gmOnly","active","finished"].map(role=>findManaged(role,rootQ)?.id)].filter(Boolean));
  for(const {key,parent} of FOLDER_FIELDS){
    const expectedParent=parent?rootQ:null;
    for(const folder of game.folders){
      if(!matchesParent(folder,expectedParent) || ours.has(folder.id))continue;
      if(folder.name.toLocaleLowerCase()===names[key].toLocaleLowerCase())
        throw new Error(`A different Journal folder already uses the name "${names[key]}". Choose another name.`);
    }
  }
  return names;
}
export async function roots(){
  assertGM();
  return {factions:await ensureManaged("factionRoot"),quests:await ensureManaged("questRoot")};
}
/** Administrative state controls a Quest's single physical Journal folder. */
export async function questFolder(_faction,status="available"){
  const {quests:root}=await roots();
  if(status==="unavailable")return ensureManaged("gmOnly",root);
  if(status==="inactive")return ensureManaged("finished",root);
  return ensureManaged("active",root);
}
function folderDepth(folder){let depth=0;const visited=new Set();for(let p=folder?.folder;p&&!visited.has(p.id);p=p.folder){visited.add(p.id);depth++;}return depth;}
function within(folder,root){const seen=new Set();for(let p=folder;p&&!seen.has(p.id);p=p.folder){if(p.id===root.id)return true;seen.add(p.id);}return false;}
function emptyFolder(folder){return !game.journal.some(j=>j.folder?.id===folder.id) &&
  !game.folders.some(child=>child.folder?.id===folder.id);}
/** Idempotent, production-safe v4 folder migration.
 * Only module-flagged Faction/Quest JournalEntry documents may be moved.
 * Journal IDs, page contents, permissions, progress, ledgers and payout receipts
 * are untouched. Empty, known legacy folders are removed bottom-up only when
 * they have no Journal and no child folder. Failures leave the migration retryable.
 */
export async function synchronizeQuestFolders(){
  assertGM();
  const legacyQuestRoot=directFolder(LEGACY_FOLDER_QUESTS);
  const legacyFactionRoot=directFolder(LEGACY_FOLDER_FACTIONS);
  const {quests:questRoot,factions:factionRoot}=await roots();
  const gmOnly=await ensureManaged("gmOnly",questRoot);
  const active=await ensureManaged("active",questRoot);
  const finished=await ensureManaged("finished",questRoot);
  const recognizedRoots=[questRoot,...(legacyQuestRoot && legacyQuestRoot.id!==questRoot.id?[legacyQuestRoot]:[])];
  // Capture old faction/Inactive folders before moving their last Quest.
  const oldFolderIds=new Set();
  const factionNames=new Set(factions().map(f=>f.name));
  for(const root of recognizedRoots){
    for(const folder of game.folders.filter(f=>f.type==="JournalEntry" && within(f,root) && f.id!==root.id)){
      if(folder.id===gmOnly.id||folder.id===active.id||folder.id===finished.id)continue;
      const top=folder.folder?.id===root.id;
      const isLegacyTop=top && factionNames.has(folder.name);
      const isLegacyNested=folder.name===LEGACY_INACTIVE_FOLDER && folder.folder && factionNames.has(folder.folder.name) && folder.folder.folder?.id===root.id;
      if(isLegacyTop || isLegacyNested)oldFolderIds.add(folder.id);
    }
  }
  const taggedFactions=game.journal.filter(j=>j.getFlag(ID,"kind")==="faction");
  for(const journal of taggedFactions){
    if(journal.folder?.id!==factionRoot.id)await journal.update({folder:factionRoot.id});
  }
  const taggedQuests=game.journal.filter(j=>j.getFlag(ID,"kind")==="quest");
  for(const journal of taggedQuests){
    // Intentional GM-controlled physical filing is replaced by the approved
    // Active/Finished structure; no unrelated Journals are ever modified.
    const status=journal.getFlag(ID,"status")??"unavailable";
    const target=status==="inactive"?finished:status==="available"?active:gmOnly;
    if(journal.folder?.id!==target.id)await journal.update({folder:target.id});
  }
  // Do not delete any folders still holding documents or subfolders. Unrelated
  // custom folders survive even if nested in the module's old root.
  const cleanup=[...oldFolderIds].map(id=>game.folders.get(id)).filter(Boolean).sort((a,b)=>folderDepth(b)-folderDepth(a));
  for(const folder of cleanup)if(emptyFolder(folder))await folder.delete();
  for(const legacy of [legacyQuestRoot,legacyFactionRoot]){
    if(legacy && legacy.id!==questRoot.id && legacy.id!==factionRoot.id && emptyFolder(legacy))await legacy.delete();
  }
  return {quests:taggedQuests.length,factions:taggedFactions.length};
}
/** Apply World settings only to the five native Folder documents. No Journal moves,
 * Actor updates or new Folder IDs occur when renaming/recoloring existing folders.
 * Persisted IDs/role flags keep this idempotent after F5 or future upgrades.
 */
export async function applyManagedFolderSettings(){
  assertGM();
  const {factions,quests}=await roots();
  await ensureManaged("gmOnly",quests);
  await ensureManaged("active",quests);
  await ensureManaged("finished",quests);
  return {factions:factions.id,quests:quests.id};
}
/** Historical exported name for the v0.1.4 settings integration. */
export async function applyManagedFolderColors(){return applyManagedFolderSettings();}

function sortedRanks(ranks) {
  // Retain stable rank/benefit IDs and future-compatible metadata on every save.
  return normalizeFactionRanks(ranks);
}
function factionHTML(name, description, image, ranks) {
  return `<section class="hqr-journal"><h1>${esc(name)}</h1>${image?`<figure class="hqr-faction-media"><img class="hqr-faction-art" src="${esc(image)}" alt="${esc(name)}"></figure>`:""}<div>${htmlText(description)}</div><h2>Renown Ranks</h2><table><thead><tr><th>Rank</th><th>Minimum Renown</th></tr></thead><tbody>${ranks.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.min}</td></tr>`).join("")}</tbody></table></section>`;
}
export function questHTML(name,data) {
  const status=String(data.status??"available").replaceAll("-"," ");
  const objectives=(data.objectives??[]).map(o=>`<li>${o.done?"☑":"☐"} ${esc(o.text)}</li>`).join("");
  const rewards=[];
  const currency=CURRENCIES.filter(k=>Number(data.currency?.[k])>0).map(k=>`${Number(data.currency[k])} ${k.toUpperCase()}`).join(", ");
  if (currency) rewards.push(`<li><strong>Currency:</strong> ${esc(currency)}</li>`);
  for (const item of (data.items??[])) {
    if (!item.uuid) continue;
    // Foundry's native UUID enrichment creates inline links with Item previews where supported.
    rewards.push(`<li><strong>Item:</strong> @UUID[${esc(item.uuid)}]{${esc(item.name||"Item")}} × ${Math.max(1,Number(item.quantity)||1)}</li>`);
  }
  for (const reward of (data.renownRewards??[])) {
    const affected=getFaction(reward.factionUuid);
    const amount=Number(reward.amount);
    if (!affected || !Number.isInteger(amount) || amount===0) continue;
    rewards.push(`<li><strong>Renown:</strong> ${amount>0?"+":""}${amount} — ${esc(affected.name)}</li>`);
  }
  const names = (data.assignees??[]).map(id=>game.actors.get(id)?.name).filter(Boolean);
  const assigned = names.join(", ") || "Not yet assigned";
  return `<section class="hqr-journal"><h1>${esc(name)}</h1><p class="hqr-journal-subtitle">${esc(questFactionLabel(data.factionUuid))} · ${esc(status)}</p><h2>Quest Briefing</h2><div>${htmlText(data.flavor??"")}</div><h2>Objectives</h2><ul>${objectives||"<li>No objectives listed.</li>"}</ul><h2>Accepted By</h2><p>${esc(assigned)}</p><h2>Rewards</h2><ul>${rewards.join("")||"<li>No announced rewards.</li>"}</ul></section>`;
}
async function setPage(doc, gmOnly, name, html) {
  const page=docPage(doc,gmOnly);
  if (page) {
    await page.update({name, "text.content":html, ownership:gmOnly?{default:OWN_NONE}: {default:-1}});
  } else {
    await doc.createEmbeddedDocuments("JournalEntryPage",[pageText(name,html,gmOnly)]);
  }
}
export async function privatePage(doc) {
  const page=docPage(doc,true);
  if (!page) return null;
  // Explicit NONE for every player, including a per-user override at the page level.
  const ownership={default:OWN_NONE};
  for (const user of game.users) if (!user.isGM) ownership[user.id]=OWN_NONE;
  if (JSON.stringify(page.ownership)!==JSON.stringify(ownership)) await page.update({ownership});
  return page;
}
export async function saveFaction(doc, {name,description,image,notes,ranks}) {
  assertGM();
  if (!name?.trim()) throw new Error("Faction name is required.");
  const root=(await roots()).factions;
  const fields={description:String(description??""),image:String(image??""),ranks:sortedRanks(ranks)};
  if (!doc) {
    doc = await JournalEntry.create({name:name.trim(),folder:root.id,ownership:{default:OWN_NONE},
      flags:{[ID]:{kind:"faction",...fields}},pages:[pageText("Faction Profile",factionHTML(name,fields.description,fields.image,fields.ranks)),pageText("GM Notes",htmlText(notes),true)]});
  } else {
    if (doc.getFlag(ID,"kind")!=="faction") throw new Error("Not a managed Faction.");
    await doc.update({name:name.trim(),folder:root.id,ownership:{default:OWN_NONE},[`flags.${ID}.description`]:fields.description,[`flags.${ID}.image`]:fields.image,[`flags.${ID}.ranks`]:fields.ranks});
    await setPage(doc,false,"Faction Profile",factionHTML(name,fields.description,fields.image,fields.ranks));
    await setPage(doc,true,"GM Notes",htmlText(notes));
  }
  await privatePage(doc);
  await reconcileAccess();
  return doc;
}
export async function saveQuest(doc, {name,notes,...data}) {
  assertGM();
  if (!name?.trim()) throw new Error("Quest name is required.");
  const rewardRows=Array.isArray(data.renownRewards)?data.renownRewards:[];
  const seen=new Set();
  const renownRewards=rewardRows.map(row=>({
    id:String(row.id??"").trim() || foundry.utils.randomID(),
    factionUuid:String(row.factionUuid??""),
    amount:Number(row.amount)
  }));
  for(const reward of renownRewards){
    if(!getFaction(reward.factionUuid))throw new Error("Choose an existing Faction for each Renown reward.");
    if(!Number.isInteger(reward.amount))throw new Error("Renown values must be whole numbers.");
    if(seen.has(reward.factionUuid))throw new Error("Each Faction may appear only once in Renown rewards.");
    seen.add(reward.factionUuid);
  }
  const failurePenalties=(Array.isArray(data.failurePenalties)?data.failurePenalties:[]).map(row=>({
    id:String(row.id??"").trim() || foundry.utils.randomID(),
    factionUuid:String(row.factionUuid??""),amount:Number(row.amount)
  }));
  const failureSeen=new Set();
  for(const row of failurePenalties){
    if(!getFaction(row.factionUuid))throw new Error("Choose an existing Faction for each Failure Penalty.");
    if(!Number.isSafeInteger(row.amount)||row.amount>=0)throw new Error("Failure Renown penalties must be negative whole numbers.");
    if(failureSeen.has(row.factionUuid))throw new Error("Each Faction may appear only once in Failure Penalties.");
    failureSeen.add(row.factionUuid);
  }
  const failureEnabled=Boolean(data.failurePenaltiesEnabled);
  if((doc?.getFlag(ID,"failurePayouts")??[]).length || doc?.getFlag(ID,"activeFailureTurnIn")){
    const orig=doc.flags[ID];
    if(failureEnabled!==Boolean(orig.failurePenaltiesEnabled) ||
      JSON.stringify(failurePenalties)!==JSON.stringify(orig.failurePenalties??[]))
      throw new Error("Failure Penalties already issued; penalty definitions are locked.");
  }
  const ownerUuid=questOwnerUuid(data.factionUuid);
  // None is a legitimate selection; an unresolved nonempty UUID is not.
  const faction=ownerUuid?getFaction(ownerUuid):null;
  // Existing orphan references can be retained unchanged during unrelated edits;
  // they must never be silently adopted as independent or introduced on new Quests.
  if(ownerUuid&&!faction && (!doc || ownerUuid!==questOwnerUuid(doc.getFlag(ID,'factionUuid'))))
    throw new Error('Owner Faction no longer exists. Select No Faction or another existing Faction.');
  const ownerLocked=Boolean((doc?.getFlag(ID,'payouts')??[]).length || doc?.getFlag(ID,'activeTurnIn') ||
    (doc?.getFlag(ID,'failurePayouts')??[]).length || doc?.getFlag(ID,'activeFailureTurnIn') ||
    doc?.getFlag(ID,'activeFailureReversal'));
  if(ownerLocked && ownerUuid!==questOwnerUuid(doc?.getFlag(ID,'factionUuid')))
    throw new Error('Owner Faction is locked after the first Turn-In or pending payout.');
  if((doc?.getFlag(ID,"payouts")??[]).length || doc?.getFlag(ID,"activeTurnIn")) {
    const orig=doc.flags[ID];
    const normalizedItems=rows=>(rows??[]).map(({uuid,quantity})=>({uuid,quantity:Number(quantity)}));
    if(JSON.stringify(data.currency??{})!==JSON.stringify(orig.currency??{}) ||
       JSON.stringify(normalizedItems(data.items))!==JSON.stringify(normalizedItems(orig.items)) ||
       JSON.stringify(renownRewards)!==JSON.stringify(orig.renownRewards??[]))
      throw new Error("Rewards have already been issued; reward definitions are locked.");
  }
  const folder = await questFolder(faction,doc?.getFlag(ID,"status")??"unavailable");
  const normalized={
    factionUuid:ownerUuid, status:doc?.getFlag(ID,"status")??"unavailable", flavor:String(data.flavor??""),
    assignment:doc?.getFlag(ID,"assignment")==="individual"?"individual":"none",
    assignees:doc?.getFlag(ID,"assignees")??[], progress:doc?.getFlag(ID,"progress")??{},
    payouts:doc?.getFlag(ID,"payouts")??[], groupAwards:doc?.getFlag(ID,"groupAwards")??{},
    objectives:Array.isArray(data.objectives)?data.objectives:[],
    currency:Object.fromEntries(CURRENCIES.map(k=>[k,Math.max(0,Math.trunc(Number(data.currency?.[k])||0))])),
    items:Array.isArray(data.items)?data.items:[], renownRewards,
    failurePenaltiesEnabled:failureEnabled, failurePenalties,
    failurePayouts:doc?.getFlag(ID,"failurePayouts")??[],
    groupFailures:doc?.getFlag(ID,"groupFailures")??{},
    lootRecipientId:doc?.getFlag(ID,"lootRecipientId")??""
  };
  if (!doc) {
    doc = await JournalEntry.create({name:name.trim(),folder:folder.id,ownership:{default:OWN_NONE},
      flags:{[ID]:{kind:"quest",...normalized}},
      pages:[pageText("Quest Briefing",questHTML(name,normalized)),pageText("GM Notes",htmlText(notes),true)]});
  } else {
    if (doc.getFlag(ID,"kind")!=="quest") throw new Error("Not a managed Quest.");
    const changes={name:name.trim(),folder:folder.id,ownership:{default:OWN_NONE}};
    for (const [k,v] of Object.entries(normalized)) changes[`flags.${ID}.${k}`]=v;
    await doc.update(changes);
    await setPage(doc,false,"Quest Briefing",questHTML(name,normalized));
    await setPage(doc,true,"GM Notes",htmlText(notes));
  }
  await privatePage(doc);
  await reconcileAccess();
  return doc;
}
export function isDiscoverable(actor,factionUuid) {
  return (actor?.getFlag(ID,"ledger")??[]).some(x=>x.factionUuid===factionUuid);
}
function questCharacters(journal) {
  // Preserve journal access for Completed AND Failed Characters after Inactive.
  return getQuestParticipants(journal);
}
export async function reconcileAccess() {
  if (!game.user?.isGM || syncing) return;
  syncing=true;
  try {
    for (const journal of game.journal.filter(j=>["quest","faction"].includes(j.getFlag(ID,"kind")))) {
      const isQuest=journal.getFlag(ID,"kind")==="quest";
      const known = isQuest ? questCharacters(journal) : game.actors.filter(a=>["character","group"].includes(a.type) && isDiscoverable(a,journal.uuid));
      const actors=isQuest ? known : known.flatMap(a=>a.type==="group"?groupMembers(a):eligible(a)?[a]:[]);
      const allowed=new Set(actors.flatMap(a=>ownerUsers(a).map(u=>u.id)));
      const ownership={default:OWN_NONE};
      for (const user of game.users) if (!user.isGM) ownership[user.id] = allowed.has(user.id)?OWN_OBSERVER:OWN_NONE;
      // Guard against over-permissive manual changes to managed documents.
      if (JSON.stringify(journal.ownership)!==JSON.stringify(ownership)) await journal.update({ownership});
      await privatePage(journal);
    }
  } catch(error) { console.error(`${ID} | Permission synchronization failed`,error); }
  finally {syncing=false;}
}
/** Refresh public faction labels after a rename. Quest folders are independent
 * of their associated Faction as of v0.0.9. Preserves all Quest UUIDs and data.
 */
export async function renameFactionFolders(faction,_oldName=null) {
  if(!game.user?.isGM)return;
  for(const journal of game.journal.filter(j=>j.getFlag(ID,"kind")==="quest" && j.getFlag(ID,"factionUuid")===faction.uuid)) {
    await setPage(journal,false,"Quest Briefing",questHTML(journal.name,journal.flags[ID]));
  }
}
export function getGMNotes(doc) {
  const html=docPage(doc,true)?.text?.content??"";
  const div=document.createElement("div"); div.innerHTML=html;
  return div.innerText??div.textContent??"";
}

/** Availability is global; progress belongs to each assigned Character. */
export async function setQuestAvailability(doc, status) {
  assertGM();
  if(doc?.getFlag(ID,"kind")!=="quest")throw new Error("Choose a Quest.");
  if(!["available","unavailable","inactive"].includes(status))throw new Error("Invalid Quest availability.");
  if(doc.getFlag(ID,"activeTurnIn") || doc.getFlag(ID,"activeFailureTurnIn") || doc.getFlag(ID,"activeFailureReversal"))throw new Error("Resolve the pending Turn-In or Undo Failure before changing availability.");
  // Availability is not a per-Character outcome. Never auto-fail recipients.
  // In particular, preserve all Completed and historical Failed records in production.
  const faction=getFaction(doc.getFlag(ID,"factionUuid"));
  const destination=await questFolder(faction,status);
  await doc.update({[`flags.${ID}.status`]:status,...(destination?.id!==doc.folder?.id?{folder:destination.id}:{})});
  await setPage(doc,false,"Quest Briefing",questHTML(doc.name,doc.flags[ID]));
  await reconcileAccess();
}
export function getQuestParticipants(doc) {
  return [...new Set(doc?.getFlag(ID,"assignees")??[])]
    .map(id=>game.actors.get(id)).filter(eligible);
}
export function progressOf(doc, actorId) {
  const progress=doc?.getFlag(ID,"progress")??{};
  return progress[actorId]?.status??((doc?.getFlag(ID,"assignees")??[]).includes(actorId)?"accepted":"unassigned");
}
export async function giveQuest(doc,{assignees}={}) {
  assertGM();
  if(doc?.getFlag(ID,"kind")!=="quest")throw new Error("Choose a Quest.");
  if(doc.getFlag(ID,"status")!=="available")throw new Error("Only Available Quests can be given.");
  if(doc.getFlag(ID,"activeFailureReversal"))throw new Error("Resume pending Undo Failure before Giving this Quest.");
  const ids=[...new Set(assignees??[])];
  if(!ids.length||ids.some(id=>!eligible(game.actors.get(id))))
    throw new Error("Select at least one eligible Character with an explicit non-GM Owner.");
  const original=new Set(doc.getFlag(ID,"assignees")??[]);
  const progress={...(doc.getFlag(ID,"progress")??{})};
  const additions=ids.filter(id=>!original.has(id));
  if(!additions.length)throw new Error("All selected Characters already received this Quest.");
  const at=new Date().toISOString();
  for(const id of additions){original.add(id);progress[id]={status:"accepted",acceptedAt:at};}
  await doc.update({[`flags.${ID}.assignment`]:"individual",[`flags.${ID}.assignees`]:[...original],
    [`flags.${ID}.progress`]:progress});
  await setPage(doc,false,"Quest Briefing",questHTML(doc.name,doc.flags[ID]));
  await reconcileAccess();
  return additions.length;
}
