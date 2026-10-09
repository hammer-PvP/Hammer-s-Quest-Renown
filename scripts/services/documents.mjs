import {ID,FOLDER_FACTIONS,FOLDER_QUESTS,DEFAULT_RANKS,assertGM,esc,htmlText,factions,ownerUsers,eligible,groupMembers,CURRENCIES} from "../constants.mjs";

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
export async function ensureFolder(name, parent=null) {
  assertGM();
  const folder = game.folders.find(f=>f.type==="JournalEntry" && f.name===name && (f.folder?.id??null)===(parent?.id??null));
  return folder ?? Folder.create({name,type:"JournalEntry",folder:parent?.id??null});
}
export async function roots() {
  return { factions:await ensureFolder(FOLDER_FACTIONS), quests:await ensureFolder(FOLDER_QUESTS) };
}
function sortedRanks(ranks) {
  const valid = (ranks??[]).filter(r=>String(r.name??"").trim() && Number.isFinite(Number(r.min)));
  return valid.length ? valid.map(r=>({name:String(r.name).trim(),min:Math.trunc(Number(r.min))})).sort((a,b)=>a.min-b.min) : DEFAULT_RANKS;
}
function factionHTML(name, description, image, ranks) {
  return `<section class="hqr-journal"><h1>${esc(name)}</h1>${image?`<img class="hqr-faction-art" src="${esc(image)}" alt="">`:""}<div>${htmlText(description)}</div><h2>Renown Ranks</h2><table><thead><tr><th>Rank</th><th>Minimum Renown</th></tr></thead><tbody>${ranks.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.min}</td></tr>`).join("")}</tbody></table></section>`;
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
  if (Number(data.renown)) rewards.push(`<li><strong>Renown:</strong> ${Number(data.renown)>0?"+":""}${Number(data.renown)}${faction?` — ${esc(faction.name)}`:""}</li>`);
  const names = (data.assignees??[]).map(id=>game.actors.get(id)?.name).filter(Boolean);
  const assigned = data.assignment === "group" ? (game.actors.get(data.groupId)?.name ?? "Unassigned") : data.assignment === "individual" ? (names.join(", ") || "Unassigned") : "Not yet assigned";
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
  if (doc?.getFlag(ID,"claimed")) {
    const original=doc.flags[ID];
    const comparable=k=>JSON.stringify(data[k]??null)===JSON.stringify(original[k]??null);
    const compactItems=arr=>(arr??[]).map(({uuid,quantity,name})=>({uuid,quantity:Number(quantity),name}));
    if (!["currency","renown","factionUuid"].every(comparable)
        || JSON.stringify(compactItems(data.items))!==JSON.stringify(compactItems(original.items)))
      throw new Error("Rewards have been issued. Reward and Faction values are locked to prevent discrepancies.");
  }
  const root=(await roots()).quests;
  const faction=getFaction(data.factionUuid);
  if(!faction) throw new Error("Select an existing Faction for this Quest.");
  const folder = faction ? await ensureFolder(faction.name,root):root;
  const normalized={
    factionUuid:faction?.uuid??"", status:doc?.getFlag(ID,"status")??"unavailable", flavor:String(data.flavor??""),
    assignment:doc?.getFlag(ID,"assignment")??"none", groupId:doc?.getFlag(ID,"groupId")??"",
    assignees:doc?.getFlag(ID,"assignees")??[],
    objectives:Array.isArray(data.objectives)?data.objectives:[],
    currency:Object.fromEntries(CURRENCIES.map(k=>[k,Math.max(0,Math.trunc(Number(data.currency?.[k])||0))])),
    items:Array.isArray(data.items)?data.items:[], renown:Math.trunc(Number(data.renown)||0),
    renownScope:doc?.getFlag(ID,"renownScope")??"group", lootRecipientId:doc?.getFlag(ID,"lootRecipientId")??""
  };
  if (!doc) {
    doc = await JournalEntry.create({name:name.trim(),folder:folder.id,ownership:{default:OWN_NONE},
      flags:{[ID]:{kind:"quest",...normalized,claimed:false}},
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
  if (!["offered","accepted","in-progress","completed","failed","abandoned"].includes(journal.getFlag(ID,"status"))) return [];
  // Quest flags are stored flat in the managed namespace.
  const mode=journal.getFlag(ID,"assignment")??"group";
  if(mode==="group") return groupMembers(game.actors.get(journal.getFlag(ID,"groupId")));
  if(mode==="individual") return (journal.getFlag(ID,"assignees")??[]).map(id=>game.actors.get(id)).filter(eligible);
  return [];
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
  target??=await ensureFolder(faction.name,root);
  for (const journal of game.journal.filter(j=>j.getFlag(ID,"kind")==="quest" && j.getFlag(ID,"factionUuid")===faction.uuid)) {
    if(journal.folder?.id!==target.id) await journal.update({folder:target.id});
    await setPage(journal,false,"Quest Briefing",questHTML(journal.name,journal.flags[ID]));
  }
}
export function getGMNotes(doc) {
  const html=docPage(doc,true)?.text?.content??"";
  const div=document.createElement("div"); div.innerHTML=html;
  return div.innerText??div.textContent??"";
}

/** GM-only quest lifecycle operations, separate from editing quest definitions. */
export async function setQuestAvailability(doc, available) {
  assertGM();
  if (doc?.getFlag(ID,"kind")!=="quest") throw new Error("Choose a Quest.");
  const current=doc.getFlag(ID,"status");
  if (!["available","unavailable"].includes(current)) throw new Error("Only unassigned Quests can be made available/unavailable.");
  const status=available?"available":"unavailable";
  await doc.setFlag(ID,"status",status);
  await setPage(doc,false,"Quest Briefing",questHTML(doc.name,doc.flags[ID]));
  await reconcileAccess();
}
export function getQuestParticipants(doc) {
  const mode=doc?.getFlag(ID,"assignment");
  if (mode==="group") return groupMembers(game.actors.get(doc.getFlag(ID,"groupId")));
  if (mode==="individual") return (doc.getFlag(ID,"assignees")??[]).map(id=>game.actors.get(id)).filter(eligible);
  return [];
}
export async function giveQuest(doc,{assignment,groupId,assignees,status="offered"}) {
  assertGM();
  if (doc?.getFlag(ID,"kind")!=="quest") throw new Error("Choose a Quest.");
  if (doc.getFlag(ID,"status")!=="available") throw new Error("Quest must be Available before Giving.");
  if (!["offered","accepted","in-progress"].includes(status)) throw new Error("Invalid Giving status.");
  if (assignment==="group") {
    if (game.actors.get(groupId)?.type!=="group") throw new Error("Select a valid Group Actor.");
    assignees=[];
  } else if(assignment==="individual") {
    assignees=[...new Set(assignees??[])].filter(id=>eligible(game.actors.get(id)));
    if (!assignees.length) throw new Error("Select at least one Character with explicit non-GM Owner.");
    groupId="";
  } else throw new Error("Choose Group or Individual Characters.");
  await doc.update({[`flags.${ID}.assignment`]:assignment,[`flags.${ID}.groupId`]:groupId??"",
    [`flags.${ID}.assignees`]:assignees,[`flags.${ID}.status`]:status});
  await setPage(doc,false,"Quest Briefing",questHTML(doc.name,doc.flags[ID]));
  await reconcileAccess();
}
export async function setQuestOutcome(doc,status) {
  assertGM();
  if (doc?.getFlag(ID,"kind")!=="quest") throw new Error("Choose a Quest.");
  if (!["offered","accepted","in-progress","completed","failed","abandoned"].includes(doc.getFlag(ID,"status"))) throw new Error("Quest has not been assigned.");
  if (!["accepted","in-progress","completed","failed","abandoned"].includes(status)) throw new Error("Invalid Quest state.");
  if (doc.getFlag(ID,"claimed") && status!=="completed") throw new Error("Rewards have already been claimed. Cannot change away from Completed.");
  await doc.setFlag(ID,"status",status);
  await setPage(doc,false,"Quest Briefing",questHTML(doc.name,doc.flags[ID]));
  await reconcileAccess();
}
