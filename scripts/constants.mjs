export const ID = "hammer-s-quest-renown";
export const FOLDER_FACTIONS = "Factions - Hammer's Quest & Renown";
export const FOLDER_QUESTS = "Quests - Hammer's Quest & Renown";
export const STATUS = ["unavailable", "available", "offered", "accepted", "in-progress", "completed", "failed", "abandoned"];
export const OFFER_STATES = ["offered", "accepted", "in-progress"];
export const TERMINAL_STATES = ["completed", "failed", "abandoned"];
export const DEFAULT_RANKS = [
  {name:"Hostile", min:-25}, {name:"Unfriendly",min:-10},
  {name:"Neutral",min:0}, {name:"Friendly",min:10},
  {name:"Honored",min:25}, {name:"Exalted",min:50}
];
export const CURRENCIES = ["pp","gp","ep","sp","cp"];
export const CLONE = value => foundry.utils.deepClone(value);
export const isGM = () => Boolean(game.user?.isGM);
export const esc = value => String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
export const htmlText = value => esc(value).replaceAll(/\r?\n/g,"<br>");
export function assertGM() { if (!isGM()) throw new Error("GM permission required."); }
export function report(error, context="Operation failed") { console.error(`${ID} | ${context}`, error); ui.notifications.error(`${context}: ${error.message ?? error}`); }
export function eligible(actor) { return actor?.type === "character" && game.users.some(user => !user.isGM && Number(actor.ownership?.[user.id]) === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER); }
export function groupMembers(group) {
  if (!group || group.type !== "group") return [];
  return (group.system?.members ?? []).map(m => m.actor).filter(eligible).filter((a,i,all)=>all.findIndex(x=>x.id===a.id)===i);
}
export function ownerUsers(actor) {
  if (!actor) return [];
  return game.users.filter(u=>!u.isGM && Number(actor.ownership?.[u.id])===CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
}
export const factions = () => game.journal.filter(j=>j.getFlag(ID,"kind")==="faction").sort((a,b)=>a.name.localeCompare(b.name));
export const quests = () => game.journal.filter(j=>j.getFlag(ID,"kind")==="quest").sort((a,b)=>a.name.localeCompare(b.name));
export function rankFor(faction, value) {
  const ranks = (faction?.getFlag(ID,"ranks") ?? DEFAULT_RANKS).map(r=>({name:String(r.name), min:Number(r.min)})).sort((a,b)=>a.min-b.min);
  return ranks.filter(r=>Number(value)>=r.min).at(-1)?.name ?? ranks[0]?.name ?? "Unranked";
}
