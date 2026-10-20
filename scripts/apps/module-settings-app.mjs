import {ID,assertGM,report} from "../constants.mjs";
import {getClassCatalogOptions,saveClassCatalog} from "../services/class-catalog.mjs";
import {COLOR_FIELDS,DEFAULT_FOLDER_COLORS,getFolderColors,saveFolderColors} from "../services/folder-settings.mjs";
import {applyManagedFolderColors} from "../services/documents.mjs";
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
    const saved=getFolderColors();
    return {classes:catalog.entries,totalClasses:catalog.entries.length,
      selectedCount:catalog.entries.filter(entry=>entry.enabled).length,
      initialized:catalog.initialized,errors:catalog.errors,
      colors:COLOR_FIELDS.map(field=>({...field,value:saved[field.key]}))};
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
        const colors={};
        for(const input of root.querySelectorAll('[data-folder-color]'))colors[input.dataset.folderColor]=input.value;
        // Validate *before* any world setting is modified.
        for(const key of Object.keys(DEFAULT_FOLDER_COLORS)){
          if(!/^#[0-9a-f]{6}$/i.test(colors[key]??''))throw new Error(`Invalid color: ${key}`);
        }
        const classKeys=selected().map(row=>row.dataset.key);
        await saveFolderColors(colors);
        await saveClassCatalog(classKeys,this.classOptions);
        // If a folder update fails, the world setting remains durable and
        // the GM can retry safely; the next startup also reapplies the palette.
        await applyManagedFolderColors();
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
