import {ID,assertGM,report} from '../constants.mjs';
import {getClassCatalogOptions,saveClassCatalog} from '../services/class-catalog.mjs';
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;

/** GM-only world class selection. Changes here never rewrite Faction records. */
export class ClassCatalogApp extends HandlebarsApplicationMixin(ApplicationV2){
  static DEFAULT_OPTIONS={classes:['hqr-app','hqr-class-catalog'],position:{width:720,height:720},window:{title:'Rank Benefits — Class Catalog',resizable:true},tag:'section'};
  static PARTS={main:{template:`modules/${ID}/templates/class-catalog.hbs`}};
  constructor({onSaved=null}={}){super();this.onSaved=onSaved;this.optionsList=[];this._saving=false;}
  async _prepareContext(){
    assertGM();
    const data=await getClassCatalogOptions({refresh:true});
    this.optionsList=data.entries;
    return {...data,count:data.entries.length,selectedCount:data.entries.filter(e=>e.enabled).length};
  }
  _onRender(){
    const root=this.element;
    const rows=()=>[...root.querySelectorAll('.hqr-class-catalog-row')];
    const selected=()=>rows().filter(row=>row.querySelector('input[type="checkbox"]')?.checked);
    const count=root.querySelector('[data-class-count]');
    const updateCount=()=>{if(count)count.textContent=String(selected().length);};
    root.querySelector('[data-class-search]')?.addEventListener('input',event=>{
      const query=String(event.target.value??'').toLocaleLowerCase().trim();
      for(const row of rows())row.hidden=!row.dataset.search?.toLocaleLowerCase().includes(query);
    });
    root.querySelector('[data-class-list]')?.addEventListener('change',updateCount);
    root.querySelector('[data-action="select-all-classes"]')?.addEventListener('click',()=>{
      for(const row of rows())if(!row.hidden)row.querySelector('input[type="checkbox"]').checked=true;
      updateCount();
    });
    root.querySelector('[data-action="clear-classes"]')?.addEventListener('click',()=>{
      for(const row of rows())if(!row.hidden)row.querySelector('input[type="checkbox"]').checked=false;
      updateCount();
    });
    root.querySelector('[data-action="save-class-catalog"]')?.addEventListener('click',async()=>{
      if(this._saving)return;
      this._saving=true;
      const button=root.querySelector('[data-action="save-class-catalog"]');
      if(button)button.disabled=true;
      try{
        const keys=selected().map(row=>row.dataset.key);
        const count=await saveClassCatalog(keys,this.optionsList);
        await this.onSaved?.();
        ui.notifications.info(`Class Catalog saved: ${count} enabled class${count===1?'':'es'}.`);
        await this.close();
      }catch(error){report(error,'Save Class Catalog failed');}
      finally{
        this._saving=false;
        if(this.element?.querySelector('[data-action="save-class-catalog"]'))this.element.querySelector('[data-action="save-class-catalog"]').disabled=false;
      }
    });
  }
}
