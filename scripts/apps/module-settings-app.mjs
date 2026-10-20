import {ID,assertGM,report} from "../constants.mjs";
import {getClassCatalogOptions,saveClassCatalog} from "../services/class-catalog.mjs";
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
    return {classes:catalog.entries,totalClasses:catalog.entries.length,
      selectedCount:catalog.entries.filter(entry=>entry.enabled).length,
      initialized:catalog.initialized,errors:catalog.errors,
      folders:FOLDER_FIELDS.map(field=>({...field,name:savedNames[field.key],color:savedColors[field.key]}))};
  }
  _onRender(){
    const root=this.element;
    const rows=()=>[...root.querySelectorAll(".hqr-class-catalog-row")];
    const selected=()=>rows().filter(row=>row.querySelector('input[type="checkbox"]')?.checked);
    const updateCount=()=>{
      const count=root.querySelector("[data-class-count]");
      if(count)count.textContent=String(selected().length);
    };
    root.querySelector("[data-class-search]")?.addEventListener("input",event=>{
      const query=String(event.target.value??"").trim().toLocaleLowerCase();
      for(const row of rows())row.hidden=!row.dataset.search?.toLocaleLowerCase().includes(query);
    });
    root.querySelector("[data-class-list]")?.addEventListener("change",updateCount);
    for(const [action,checked] of [["select-all-classes",true],["clear-classes",false]]){
      root.querySelector(`[data-action="${action}"]`)?.addEventListener("click",()=>{
        for(const row of rows())if(!row.hidden)row.querySelector('input[type="checkbox"]').checked=checked;
        updateCount();
      });
    }
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
        const classKeys=selected().map(row=>row.dataset.key);
        // Desired state is durable before modifying native folders: a partial
        // Foundry update will be resumed safely on the next GM startup.
        await saveFolderNames(names);
        await saveFolderColors(colors);
        await applyManagedFolderSettings();
        await saveClassCatalog(classKeys,this.classOptions);
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
