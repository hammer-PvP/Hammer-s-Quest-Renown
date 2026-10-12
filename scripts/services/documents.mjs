import {ID,FOLDER_FACTIONS,FOLDER_QUESTS,DEFAULT_RANKS,assertGM,esc,htmlText,factions,ownerUsers,eligible,groupMembers,CURRENCIES} from "../constants.mjs";

export const COLORS = Object.freeze({questRoot:"#ab960d",questFaction:"#776809",factionRoot:"#890b1e",inactive:"#5a500b"});
export const INACTIVE_FOLDER = "Inativas";
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
export async function ensureFolder(name, parent=null, color=null) {
  assertGM();
  const folder = game.folders.find(f=>f.type==="JournalEntry" && f.name===name && (f.folder?.id??null)===(parent?.id??null));
  if(folder){
    // Managed folders only: do not alter arbitrary Journal folders elsewhere in the World.
    if(color && String(folder.color??"").toLowerCase()!==color)await folder.update({color});
    return folder;
  }
  return Folder.create({name,type:"JournalEntry",folder:parent?.id??null,...(color?{color}:{})});
}
export async function roots() {
  return { factions:await ensureFolder(FOLDER_FACTIONS,null,COLORS.factionRoot),
    quests:await ensureFolder(FOLDER_QUESTS,null,COLORS.questRoot) };
}
export async function questFolder(faction, status="available") {
  if(!faction)throw new Error("The Quest's Faction is missing.");
  const root=(await roots()).quests;
  const factionFolder=await ensureFolder(faction.name,root,COLORS.questFaction);
  return status==="inactive" ? ensureFolder(INACTIVE_FOLDER,factionFolder,COLORS.inactive) : factionFolder;
}
/** Idempotent repair of managed folder colors and placement, retaining Journal IDs/UUIDs.
 * Move only managed Quest Journals with resolvable Faction references.
 */
export async function synchronizeQuestFolders(){
  assertGM();
  await roots();
  for(const faction of factions()){
    const parent=(await roots()).quests;
    await ensureFolder(faction.name,parent,COLORS.questFaction);
  }
  const questRoot=game.folders.find(f=>f.type==="JournalEntry"&&f.name===FOLDER_QUESTS&& !f.folder);
  for(const journal of game.journal.filter(j=>j.getFlag(ID,"kind")==="quest")){
    const faction=getFaction(journal.getFlag(ID,"factionUuid"));
    if(!faction){console.warn(`${ID} | Cannot organize Quest without Faction: ${journal.name}`);continue;}
    const current=journal.folder;
    // Preserve any deliberately custom filing of a managed Quest elsewhere.
    // Only normalize documents currently placed within the module's recognized hierarchy.
    const inManagedLocation=!!current && (current.id===questRoot?.id ||
      current.folder?.id===questRoot?.id ||
      (current.name===INACTIVE_FOLDER && current.folder?.folder?.id===questRoot?.id));
    if(!inManagedLocation){
      console.info(`${ID} | Skipping non-standard Quest folder placement: ${journal.name}`);
      continue;
    }
    const target=await questFolder(faction,journal.getFlag(ID,"status"));
    if(journal.folder?.id!==target.id)await journal.update({folder:target.id});
  }
}
function sortedRanks(ranks) {
  const valid = (ranks??[]).filter(r=>String(r.name??"").trim() && Number.isFinite(Number(r.min)));
  return valid.length ? valid.map(r=>({name:String(r.name).trim(),min:Math.trunc(Number(r.min))})).sort((a,b)=>a.min-b.min) : DEFAULT_RANKS;
}
function factionHTML(name, description, image, ranks) {
  return `<section class="hqr-journal"><h1>${esc(name)}</h1>${image?`<figure class="hqr-faction-media"><img class="hqr-faction-art" src="${esc(image)}" alt="${esc(name)}"></figure>`:""}<div>${htmlText(description)}</div><h2>Renown Ranks</h2><table><thead><tr><th>Rank</th><th>Minimum Renown</th></tr></thead><tbody>${ranks.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.min}</td></tr>`).join("")}</tbody></table></section>`;
}
export function questHTML(name,data) {
  const faction=getFaction(data.factionUuid);
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
  return `<section class="hqr-journal"><h1>${esc(name)}</h1><p class="hqr-journal-subtitle">${esc(faction?.name??"No Faction")} · ${esc(status)}</p><h2>Quest Briefing</h2><div>${htmlText(data.flavor??"")}</div><h2>Objectives</h2><ul>${objectives||"<li>No objectives listed.</li>"}</ul><h2>Accepted By</h2><p>${esc(assigned)}</p><h2>Rewards</h2><ul>${rewards.join("")||"<li>No announced rewards.</li>"}</ul></section>`;
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
  if((doc?.getFlag(ID,"payouts")??[]).length || doc?.getFlag(ID,"activeTurnIn")) {
    const orig=doc.flags[ID];
    const normalizedItems=rows=>(rows??[]).map(({uuid,quantity})=>({uuid,quantity:Number(quantity)}));
    if(data.factionUuid!==orig.factionUuid ||
       JSON.stringify(data.currency??{})!==JSON.stringify(orig.currency??{}) ||
       JSON.stringify(normalizedItems(data.items))!==JSON.stringify(normalizedItems(orig.items)) ||
       JSON.stringify(renownRewards)!==JSON.stringify(orig.renownRewards??[]))
      throw new Error("Rewards have already been issued; reward definitions are locked.");
  }
  const faction=getFaction(data.factionUuid);
  if(!faction) throw new Error("Select an existing Faction for this Quest.");
  const folder = await questFolder(faction,doc?.getFlag(ID,"status")??"unavailable");
  const normalized={
    factionUuid:faction?.uuid??"", status:doc?.getFlag(ID,"status")??"unavailable", flavor:String(data.flavor??""),
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
export async function renameFactionFolders(faction,oldName=null) {
  if(!game.user.isGM)return;
  const root=(await roots()).quests;
  let target=game.folders.find(f=>f.type==="JournalEntry" && f.name===faction.name && f.folder?.id===root.id);
  if(!target && oldName && oldName!==faction.name) {
    const previous=game.folders.find(f=>f.type==="JournalEntry" && f.name===oldName && f.folder?.id===root.id);
    if(previous) { await previous.update({name:faction.name});target=previous; }
  }
  target??=await ensureFolder(faction.name,root,COLORS.questFaction);
  if(String(target.color??"").toLowerCase()!==COLORS.questFaction)await target.update({color:COLORS.questFaction});
  for (const journal of game.journal.filter(j=>j.getFlag(ID,"kind")==="quest" && j.getFlag(ID,"factionUuid")===faction.uuid)) {
    const destination=await questFolder(faction,journal.getFlag(ID,"status"));
    if(journal.folder?.id!==destination.id) await journal.update({folder:destination.id});
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
  const destination=faction?await questFolder(faction,status):doc.folder;
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
