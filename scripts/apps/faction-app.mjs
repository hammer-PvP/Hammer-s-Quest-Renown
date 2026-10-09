import {ID,DEFAULT_RANKS,assertGM,report,CLONE,factions} from "../constants.mjs";
import {saveFaction,getGMNotes,renameFactionFolders} from "../services/documents.mjs";
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
export class FactionApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS={classes:["hqr-app","hqr-faction"],position:{width:930,height:790},window:{title:"Faction Manager",resizable:true},tag:"section"};
  static PARTS={main:{template:`modules/${ID}/templates/faction.hbs`}};
  constructor(doc=null,options={}){super(options);this.doc=doc;this.ranks=CLONE(doc?.getFlag(ID,"ranks")??DEFAULT_RANKS);}
  async _prepareContext(){assertGM();return {isEdit:!!this.doc,docId:this.doc?.id??"",name:this.doc?.name??"",description:this.doc?.getFlag(ID,"description")??"",image:this.doc?.getFlag(ID,"image")??"",notes:this.doc?getGMNotes(this.doc):"",ranks:this.ranks.map((r,i)=>({...r,index:i})),factions:factions().map(f=>({id:f.id,name:f.name,selected:f===this.doc}))};}
  _collect(){
    const root=this.element;
    this.ranks=Array.from(root.querySelectorAll(".hqr-rank-row")).map(r=>({name:r.querySelector('[data-field="rank-name"]').value,min:Number(r.querySelector('[data-field="rank-min"]').value)}));
    return {name:root.querySelector('[name="name"]').value,description:root.querySelector('[name="description"]').value,image:root.querySelector('[name="image"]').value,notes:root.querySelector('[name="notes"]').value,ranks:this.ranks};
  }
  _onRender(){
    const root=this.element;
    const imageField=root.querySelector('input[name="image"]');
    const preview=root.querySelector('.hqr-faction-preview');
    const imageEl=root.querySelector('.hqr-faction-preview img');
    const empty=root.querySelector('.hqr-faction-preview-empty');
    const updatePreview=()=>{
      const path=imageField?.value.trim()??'';
      if(preview)preview.classList.toggle('hqr-has-image',!!path);
      if(imageEl){imageEl.hidden=!path;if(path)imageEl.src=path;else imageEl.removeAttribute('src');}
      if(empty)empty.hidden=!!path;
    };
    imageField?.addEventListener('input',updatePreview);
    imageEl?.addEventListener('error',()=>{preview?.classList.add('hqr-preview-error');});
    imageEl?.addEventListener('load',()=>{preview?.classList.remove('hqr-preview-error');});
    root.querySelector('[data-action="browse-image"]')?.addEventListener('click',()=>{
      try{
        assertGM();
        const Picker=foundry.applications.apps.FilePicker;
        const picker=new Picker({type:'image',current:imageField.value.trim(),callback:path=>{
          // No full form rerender: preserve GM Notes, rank edits, scroll and focus.
          imageField.value=path;
          preview?.classList.remove('hqr-preview-error');
          updatePreview();
          imageField.dispatchEvent(new Event('change',{bubbles:true}));
        }});
        picker.render({force:true});
      }catch(error){report(error,'Browse Faction image failed');}
    });
    root.querySelector('[data-action="clear-image"]')?.addEventListener('click',()=>{
      if(!imageField)return;
      imageField.value='';preview?.classList.remove('hqr-preview-error');updatePreview();
    });
    updatePreview();
    root.querySelector('[data-action="new"]')?.addEventListener("click",()=>{this.doc=null;this.ranks=CLONE(DEFAULT_RANKS);this.render();});
    root.querySelector('[name="existing"]')?.addEventListener("change",event=>{this.doc=game.journal.get(event.target.value)??null;this.ranks=CLONE(this.doc?.getFlag(ID,"ranks")??DEFAULT_RANKS);this.render();});
    root.querySelector('[data-action="add-rank"]')?.addEventListener("click",()=>{this._collect();this.ranks.push({name:"New Rank",min:0});this.render();});
    root.querySelectorAll('[data-action="remove-rank"]').forEach(button=>button.addEventListener("click",()=>{this._collect();this.ranks.splice(Number(button.dataset.index),1);this.render();}));
    root.querySelector('[data-action="save"]')?.addEventListener("click",async()=>{
      try {assertGM();const oldName=this.doc?.name;const input=this._collect();this.doc=await saveFaction(this.doc,input);this.ranks=CLONE(this.doc.getFlag(ID,"ranks"));if(oldName!==this.doc.name)await renameFactionFolders(this.doc,oldName);ui.notifications.info("Faction saved.");await this.render();}
      catch(error){report(error,"Save Faction failed");}
    });
    root.querySelector('[data-action="open-journal"]')?.addEventListener("click",()=>this.doc?.sheet?.render(true));
  }
}
