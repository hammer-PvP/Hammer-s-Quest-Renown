import {ID,DEFAULT_RANKS,assertGM,report,CLONE,factions} from "../constants.mjs";
import {saveFaction,getGMNotes,renameFactionFolders} from "../services/documents.mjs";
import {normalizeFactionRanks,newBenefitBlock} from "../services/rank-benefits.mjs";
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
export class FactionApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS={classes:["hqr-app","hqr-faction"],position:{width:930,height:790},window:{title:"Faction Manager",resizable:true},tag:"section"};
  static PARTS={main:{template:`modules/${ID}/templates/faction.hbs`}};
  constructor(doc=null,options={}){super(options);this.doc=doc;this.ranks=normalizeFactionRanks(CLONE(doc?.getFlag(ID,"ranks")??DEFAULT_RANKS));}
  async _prepareContext(){assertGM();return {isEdit:!!this.doc,docId:this.doc?.id??"",name:this.doc?.name??"",description:this.doc?.getFlag(ID,"description")??"",image:this.doc?.getFlag(ID,"image")??"",notes:this.doc?getGMNotes(this.doc):"",ranks:this.ranks.map((r,i)=>({...r,index:i,benefits:(r.benefits??[]).map(b=>({...b,isGeneral:b.type==="general"}))})),factions:factions().map(f=>({id:f.id,name:f.name,selected:f===this.doc}))};}
  _collect(){
    const root=this.element;
    this.ranks=Array.from(root.querySelectorAll(".hqr-rank-card")).map(card=>{
      const id=card.dataset.rankId;
      const previous=this.ranks.find(r=>r.id===id);
      const blocks=Array.from(card.querySelectorAll(".hqr-benefit-block")).map(row=>{
        const match=previous?.benefits?.find(b=>b.id===row.dataset.benefitId);
        return match??{id:row.dataset.benefitId,type:row.dataset.benefitType,items:[],classes:{}};
      });
      return {...(previous??{}),id,name:card.querySelector('[data-field="rank-name"]').value,
        min:Number(card.querySelector('[data-field="rank-min"]').value),benefits:blocks};
    });
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
    root.querySelector('[data-action="new"]')?.addEventListener("click",()=>{this.doc=null;this.ranks=normalizeFactionRanks(CLONE(DEFAULT_RANKS));this.render();});
    root.querySelector('[name="existing"]')?.addEventListener("change",event=>{this.doc=game.journal.get(event.target.value)??null;this.ranks=normalizeFactionRanks(CLONE(this.doc?.getFlag(ID,"ranks")??DEFAULT_RANKS));this.render();});
    root.querySelector('[data-action="add-rank"]')?.addEventListener("click",()=>{this._collect();this.ranks.push(...normalizeFactionRanks([{name:"New Rank",min:0}]));this.render();});
    root.querySelector('.hqr-ranks')?.addEventListener('click',event=>{
      const button=event.target.closest('button[data-action]');
      if(!button)return;
      const action=button.dataset.action;
      if(!['remove-rank','add-benefit','remove-benefit'].includes(action))return;
      this._collect();
      const id=button.closest('.hqr-rank-card')?.dataset.rankId;
      const rank=this.ranks.find(r=>r.id===id);
      if(action==='remove-rank')this.ranks=this.ranks.filter(r=>r.id!==id);
      else if(action==='add-benefit'&&rank)(rank.benefits??=[]).push(newBenefitBlock(button.dataset.type));
      else if(action==='remove-benefit'&&rank){
        const bid=button.closest('.hqr-benefit-block')?.dataset.benefitId;
        rank.benefits=(rank.benefits??[]).filter(b=>b.id!==bid);
      }
      this.render();
    });
    root.querySelector('[data-action="save"]')?.addEventListener("click",async()=>{
      try {assertGM();const oldName=this.doc?.name;const input=this._collect();this.doc=await saveFaction(this.doc,input);this.ranks=CLONE(this.doc.getFlag(ID,"ranks"));if(oldName!==this.doc.name)await renameFactionFolders(this.doc,oldName);ui.notifications.info("Faction saved.");await this.render();}
      catch(error){report(error,"Save Faction failed");}
    });
    root.querySelector('[data-action="open-journal"]')?.addEventListener("click",()=>this.doc?.sheet?.render(true));
  }
}
