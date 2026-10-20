import {ID,assertGM,report} from "../constants.mjs";
import {getClassCatalogOptions,saveClassCatalog,validateClassCatalogDraft} from "../services/class-catalog.mjs";
import {wireClassSourceControls} from "./class-source-ui.mjs";
import {FOLDER_FIELDS,DEFAULT_FOLDER_COLORS,DEFAULT_FOLDER_NAMES,getFolderColors,getFolderNames,saveFolderColors,saveFolderNames,validateFolderNames} from "../services/folder-settings.mjs";
import {applyManagedFolderSettings,validateManagedFolderNames} from "../services/documents.mjs";
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
/** Single GM-only World settings window: global class choices and native folder colors. */
export class HQRModuleSettingsApp extends HandlebarsApplicationMixin(ApplicationV2){
  static DEFAULT_OPTIONS={classes:["hqr-app","hqr-module-settings"],position:{width:740,height:760},
    window:{title:"Hammer's Quest & Renown — Settings",resizable:true},tag:"section"};
  static PARTS={main:{template:`modules/${ID}/templates/module-settings.hbs`}};
  constructor(options={}){super(options);this.classOptions=[];this._saving=false;}
  async _prepareContext(){
    assertGM();
    const catalog=await getClassCatalogOptions({refresh:true});
    this.classOptions=catalog.entries;
    const savedColors=getFolderColors(),savedNames=getFolderNames();
    return {classes:catalog.entries,sources:catalog.sources,sourcesInitialized:catalog.sourcesInitialized,totalClasses:catalog.entries.length,
      selectedCount:catalog.entries.filter(entry=>entry.enabled).length,
      initialized:catalog.initialized,errors:catalog.errors,
      folders:FOLDER_FIELDS.map(field=>({...field,name:savedNames[field.key],color:savedColors[field.key]}))};
  }
  _onRender(){
    const root=this.element;
    const classUI=wireClassSourceControls(root);
    root.querySelector('[data-action="reset-colors"]')?.addEventListener("click",()=>{
      for(const input of root.querySelectorAll('[data-folder-color]')){
        const color=DEFAULT_FOLDER_COLORS[input.dataset.folderColor];
        if(color){input.value=color;this._updateColorLabel(input);}
      }
    });
    root.querySelector('[data-action="reset-names"]')?.addEventListener("click",()=>{
      for(const input of root.querySelectorAll('[data-folder-name]')){
        const name=DEFAULT_FOLDER_NAMES[input.dataset.folderName];
        if(name)input.value=name;
      }
    });
    for(const input of root.querySelectorAll('[data-folder-color]')){
      input.addEventListener('input',()=>this._updateColorLabel(input));
      this._updateColorLabel(input);
    }
    root.querySelector('[data-action="save-settings"]')?.addEventListener('click',async()=>{
      if(this._saving)return;
      this._saving=true;
      const button=root.querySelector('[data-action="save-settings"]');
      if(button)button.disabled=true;
      try{
        const colors={},names={};
        for(const input of root.querySelectorAll('[data-folder-color]'))colors[input.dataset.folderColor]=input.value;
        for(const input of root.querySelectorAll('[data-folder-name]'))names[input.dataset.folderName]=input.value;
        // Validate *all* fields and folder-name collisions before saving anything.
        for(const key of Object.keys(DEFAULT_FOLDER_COLORS)){
          if(!/^#[0-9a-f]{6}$/i.test(colors[key]??''))throw new Error(`Invalid color: ${key}`);
        }
        validateFolderNames(names);
        validateManagedFolderNames(names);
        const classDraft=classUI.collect();
        // Abort BEFORE touching native folder settings if any class definition
        // is missing, ambiguous or incompatible with the selected source.
        await validateClassCatalogDraft(classDraft.selected,this.classOptions,{sourceIds:classDraft.sourceIds,bindings:classDraft.bindings});
        // Desired state is durable before modifying native folders: a partial
        // Foundry update will be resumed safely on the next GM startup.
        await saveFolderNames(names);
        await saveFolderColors(colors);
        await applyManagedFolderSettings();
        await saveClassCatalog(classDraft.selected,this.classOptions,{sourceIds:classDraft.sourceIds,bindings:classDraft.bindings});
        ui.notifications.info("Hammer's Quest & Renown settings saved.");
        await this.close();
      }catch(error){report(error,'Save Module Settings failed');}
      finally{this._saving=false;if(this.element?.querySelector('[data-action="save-settings"]'))this.element.querySelector('[data-action="save-settings"]').disabled=false;}
    });
  }
  _updateColorLabel(input){
    const label=this.element?.querySelector(`[data-color-label="${input.dataset.folderColor}"]`);
    if(label)label.textContent=input.value.toUpperCase();
  }
}
