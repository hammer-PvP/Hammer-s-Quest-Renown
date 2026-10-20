/** World-wide settings for native folder colors, independent of Faction data. */
import {ID,assertGM} from "../constants.mjs";
export const FOLDER_COLORS_SETTING="managedFolderColors";
export const DEFAULT_FOLDER_COLORS=Object.freeze({
  factionRoot:"#890b1e",questRoot:"#ab960d",gmOnly:"#776809",active:"#776809",finished:"#776809"
});
export const COLOR_FIELDS=Object.freeze([
  {key:"factionRoot",label:"Hammer's Factions"},
  {key:"questRoot",label:"Hammer's Quests"},
  {key:"gmOnly",label:"GM Only"},
  {key:"active",label:"Active"},
  {key:"finished",label:"Finished"}
]);
const isColor=value=>typeof value==="string"&&/^#[0-9a-f]{6}$/i.test(value);
export function registerFolderColorSettings(){
  game.settings.register(ID,FOLDER_COLORS_SETTING,{
    name:"Managed Journal Folder Colors",scope:"world",config:false,type:Object,
    default:{...DEFAULT_FOLDER_COLORS}
  });
}
export function getFolderColors(){
  const raw=game.settings.get(ID,FOLDER_COLORS_SETTING)??{};
  return Object.fromEntries(Object.entries(DEFAULT_FOLDER_COLORS).map(([key,fallback])=>
    [key,isColor(raw[key])?raw[key].toLowerCase():fallback]));
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
