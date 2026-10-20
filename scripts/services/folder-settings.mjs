/** World-wide, GM-managed identities, names and colors for native Journal folders. */
import {ID,assertGM} from "../constants.mjs";
export const FOLDER_COLORS_SETTING="managedFolderColors";
export const FOLDER_NAMES_SETTING="managedFolderNames";
export const FOLDER_IDS_SETTING="managedFolderIds";
export const DEFAULT_FOLDER_COLORS=Object.freeze({
  factionRoot:"#890b1e",questRoot:"#ab960d",gmOnly:"#776809",active:"#776809",finished:"#776809"
});
export const DEFAULT_FOLDER_NAMES=Object.freeze({
  factionRoot:"Hammer's Factions",questRoot:"Hammer's Quests",
  gmOnly:"GM Only",active:"Active",finished:"Finished"
});
export const FOLDER_FIELDS=Object.freeze([
  {key:"factionRoot",label:"Factions",parent:null},
  {key:"questRoot",label:"Quests",parent:null},
  {key:"gmOnly",label:"GM Only",parent:"questRoot"},
  {key:"active",label:"Active",parent:"questRoot"},
  {key:"finished",label:"Finished",parent:"questRoot"}
]);
// Historical export, used by earlier module versions.
export const COLOR_FIELDS=Object.freeze(FOLDER_FIELDS.map(field=>({key:field.key,label:DEFAULT_FOLDER_NAMES[field.key]})));
const isColor=value=>typeof value==="string"&&/^#[0-9a-f]{6}$/i.test(value);
export function registerFolderColorSettings(){
  game.settings.register(ID,FOLDER_COLORS_SETTING,{
    name:"Managed Journal Folder Colors",scope:"world",config:false,type:Object,
    default:{...DEFAULT_FOLDER_COLORS}
  });
  game.settings.register(ID,FOLDER_NAMES_SETTING,{
    name:"Managed Journal Folder Names",scope:"world",config:false,type:Object,
    default:{...DEFAULT_FOLDER_NAMES}
  });
  game.settings.register(ID,FOLDER_IDS_SETTING,{
    name:"Managed Journal Folder Identities",scope:"world",config:false,type:Object,default:{}
  });
}
export function getFolderColors(){
  const raw=game.settings.get(ID,FOLDER_COLORS_SETTING)??{};
  return Object.fromEntries(Object.entries(DEFAULT_FOLDER_COLORS).map(([key,fallback])=>
    [key,isColor(raw[key])?raw[key].toLowerCase():fallback]));
}
export function validateFolderNames(next){
  const result={};
  for(const {key} of FOLDER_FIELDS){
    const value=String(next?.[key]??"").trim();
    if(!value || value.length>100 || /[\r\n\t<>]/.test(value))
      throw new Error(`Invalid name for ${key}. Use 1–100 characters without line breaks or angle brackets.`);
    result[key]=value;
  }
  for(const keys of [["factionRoot","questRoot"],["gmOnly","active","finished"]]){
    if(new Set(keys.map(key=>result[key].toLocaleLowerCase())).size!==keys.length)
      throw new Error("Managed folders in the same directory must have distinct names.");
  }
  return result;
}
export function getFolderNames(){
  const raw=game.settings.get(ID,FOLDER_NAMES_SETTING)??{};
  try{return validateFolderNames({...DEFAULT_FOLDER_NAMES,...raw});}
  catch(error){console.warn(`${ID} | Invalid stored folder names; falling back to defaults`,error);return {...DEFAULT_FOLDER_NAMES};}
}
export function getFolderIds(){
  const raw=game.settings.get(ID,FOLDER_IDS_SETTING)??{};
  return Object.fromEntries(FOLDER_FIELDS.map(({key})=>[key,typeof raw[key]==="string"?raw[key]:""]));
}
export async function saveFolderNames(next){
  assertGM();
  const names=validateFolderNames(next);
  await game.settings.set(ID,FOLDER_NAMES_SETTING,names);
  return names;
}
export async function saveFolderIds(next){
  assertGM();
  const previous=getFolderIds();
  const values=Object.fromEntries(FOLDER_FIELDS.map(({key})=>[key,typeof next?.[key]==="string"?next[key]:previous[key]]));
  if(FOLDER_FIELDS.some(({key})=>values[key]!==previous[key]))
    await game.settings.set(ID,FOLDER_IDS_SETTING,values);
  return values;
}
export async function saveFolderColors(next){
  assertGM();
  const value={};
  for(const key of Object.keys(DEFAULT_FOLDER_COLORS)){
    if(!isColor(next?.[key]))throw new Error(`Invalid color for ${key}. Use #RRGGBB.`);
    value[key]=next[key].toLowerCase();
  }
  await game.settings.set(ID,FOLDER_COLORS_SETTING,value);
  return value;
}
