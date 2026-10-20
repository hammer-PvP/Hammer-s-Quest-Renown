import {ID,DEFAULT_RANKS,assertGM,report,CLONE,factions} from "../constants.mjs";
import {saveFaction,getGMNotes,renameFactionFolders} from "../services/documents.mjs";
import {normalizeFactionRanks,newBenefitBlock} from "../services/rank-benefits.mjs";
import {getEnabledClasses} from "../services/class-catalog.mjs";
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;

/** Placeholder rows reflect selected classes only. They do not create or change
 * Item grants, class Items, Actor flags or the saved Faction benefit map.
 */
function classSlotsNode(classes){
  const list=document.createElement('div');
  list.className='hqr-class-slot-list';
  if(!classes.length){
    const empty=document.createElement('p');
    empty.className='hqr-hint hqr-no-classes';
    empty.textContent='No classes enabled. Configure them in Module Settings.';
    list.append(empty);
  }
  for(const cls of classes){
    const row=document.createElement('div');
    row.className='hqr-class-slot';
    row.dataset.classKey=cls.key;
    const name=document.createElement('strong');
    name.className='hqr-class-slot-name';
    name.textContent=cls.name;
    const slot=document.createElement('span');
    slot.className='hqr-class-slot-empty';
    slot.textContent='Empty — optional';
    row.append(name,slot);
    if(cls.unavailable){row.classList.add('hqr-class-slot-unavailable');row.title='This class source is currently unavailable.';}
    list.append(row);
  }
  return list;
}
/** Creates only the new benefit node. Rank microactions never rerender the
 * ApplicationV2: drafts, focus and scrolling must survive unchanged.
 */
function benefitNode(block,classes=[]){
  const general=block.type==='general';
  const node=document.createElement('div');
  node.className='hqr-benefit-block';
  node.dataset.benefitId=block.id;
  node.dataset.benefitType=block.type;
  node.innerHTML=`<div class="hqr-benefit-head">
    <span><i class="fa-solid ${general?'fa-users':'fa-user-shield'}"></i> ${general?'General':'Class Specific'}</span>
    <button type="button" data-action="remove-benefit" title="Remove benefit block"><i class="fa-solid fa-xmark"></i></button>
  </div>`;
  if(general){
    const hint=document.createElement('p');
    hint.className='hqr-hint';
    hint.textContent='All eligible Characters. Item and Spell source linking is planned for a later version.';
    node.append(hint);
  }else{
    node.append(classSlotsNode(classes));
    const hint=document.createElement('p');
    hint.className='hqr-hint';
    hint.textContent='Class slots are optional placeholders; drag-and-drop will follow in a later version.';
    node.append(hint);
  }
  return node;
}

/** Keep a newly created block in view *within* the internal scrolling pane,
 * without scrolling the Foundry window or resetting the pane to the top.
 */
function revealWithinPane(pane,node){
  if(!pane||!node)return;
  const viewport=pane.getBoundingClientRect();
  const rect=node.getBoundingClientRect();
  if(rect.bottom>viewport.bottom)pane.scrollTop+=rect.bottom-viewport.bottom+12;
  else if(rect.top<viewport.top)pane.scrollTop-=viewport.top-rect.top+12;
}

export class FactionApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS={classes:["hqr-app","hqr-faction"],position:{width:930,height:790},window:{title:"Faction Manager",resizable:true},tag:"section"};
  static PARTS={main:{template:`modules/${ID}/templates/faction.hbs`}};
  constructor(doc=null,options={}){
    super(options);
    this.doc=doc;
    this.ranks=normalizeFactionRanks(CLONE(doc?.getFlag(ID,"ranks")??DEFAULT_RANKS));
    this._blankRankCard=null;
    this._saving=false;
    this.enabledClasses=[];
  }
  async _prepareContext(){
    assertGM();
    this.enabledClasses=await getEnabledClasses();
    return {
      classCount:this.enabledClasses.length,
      isEdit:!!this.doc,docId:this.doc?.id??"",name:this.doc?.name??"",
      description:this.doc?.getFlag(ID,"description")??"",image:this.doc?.getFlag(ID,"image")??"",
      notes:this.doc?getGMNotes(this.doc):"",
      ranks:this.ranks.map((r,i)=>({...r,index:i,benefits:(r.benefits??[]).map(b=>({...b,isGeneral:b.type==="general",isClassSpecific:b.type==="classSpecific",slots:this.enabledClasses}))})),
      factions:factions().map(f=>({id:f.id,name:f.name,selected:f===this.doc}))
    };
  }
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
    return {
      name:root.querySelector('[name="name"]').value,
      description:root.querySelector('[name="description"]').value,
      image:root.querySelector('[name="image"]').value,
      notes:root.querySelector('[name="notes"]').value,
      ranks:this.ranks
    };
  }
  /** Clone the existing rank markup, not the form. Clearing its editable
   * nodes allows add-rank even after the GM deletes every visible rank.
   */
  _addRank(){
    const list=this.element.querySelector('.hqr-ranks .hqr-list');
    const source=this._blankRankCard??list?.querySelector('.hqr-rank-card');
    if(!list||!source)throw new Error('Rank editor template is unavailable.');
    const fresh=normalizeFactionRanks([{name:'New Rank',min:0}])[0];
    const card=source.cloneNode(true);
    card.dataset.rankId=fresh.id;
    card.querySelector('[data-field="rank-name"]').value=fresh.name;
    card.querySelector('[data-field="rank-min"]').value=String(fresh.min);
    card.querySelector('.hqr-block-list').replaceChildren();
    list.append(card);
    const field=card.querySelector('[data-field="rank-name"]');
    field.focus({preventScroll:true});
    revealWithinPane(this.element.querySelector('.hqr-scroll'),field);
  }
  /** Render only per-class placeholder rows after a change to global class
   * settings. Never replace any rank/form field or rebuild the entire sheet.
   */
  async _refreshClassSlots(){
    this.enabledClasses=await getEnabledClasses();
    const root=this.element;
    for(const block of root?.querySelectorAll('.hqr-benefit-block[data-benefit-type="classSpecific"]')??[]){
      const old=block.querySelector('.hqr-class-slot-list');
      if(old)old.replaceWith(classSlotsNode(this.enabledClasses));
      else block.querySelector('.hqr-benefit-head')?.after(classSlotsNode(this.enabledClasses));
    }
    const count=root?.querySelector('[data-enabled-classes]');
    if(count)count.textContent=String(this.enabledClasses.length);
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
    // This is a markup-only template. It is NEVER inserted into the live list
    // until the GM explicitly asks to create a rank.
    const sample=root.querySelector('.hqr-rank-card');
    if(sample)this._blankRankCard=sample.cloneNode(true);
    // Switching to a different Faction or deliberately requesting New is a
    // document change, unlike add/remove actions inside a single draft.
    root.querySelector('[data-action="new"]')?.addEventListener('click',()=>{
      this.doc=null;
      this.ranks=normalizeFactionRanks(CLONE(DEFAULT_RANKS));
      this.render();
    });
    root.querySelector('[name="existing"]')?.addEventListener('change',event=>{
      this.doc=game.journal.get(event.target.value)??null;
      this.ranks=normalizeFactionRanks(CLONE(this.doc?.getFlag(ID,"ranks")??DEFAULT_RANKS));
      this.render();
    });
    // Structural edits are DOM-local. Existing inputs, textarea drafts, File
    // Picker state, scroll and focus retain their original live DOM nodes.
    root.querySelector('[data-action="add-rank"]')?.addEventListener('click',()=>{
      try{this._addRank();}catch(error){report(error,'Add Rank failed');}
    });
    root.querySelector('.hqr-ranks')?.addEventListener('click',event=>{
      const button=event.target.closest('button[data-action]');
      if(!button)return;
      const action=button.dataset.action;
      if(!['remove-rank','add-benefit','remove-benefit'].includes(action))return;
      const card=button.closest('.hqr-rank-card');
      if(!card)return;
      if(action==='remove-rank'){
        // Keep the template when the last rank is removed.
        this._blankRankCard??=card.cloneNode(true);
        card.remove();
        root.querySelector('[data-action="add-rank"]')?.focus({preventScroll:true});
      }else if(action==='add-benefit'){
        try{
          const block=newBenefitBlock(button.dataset.type);
          const node=benefitNode(block,this.enabledClasses);
          card.querySelector('.hqr-block-list').append(node);
          revealWithinPane(root.querySelector('.hqr-scroll'),node);
        }catch(error){report(error,'Add Benefit failed');}
      }else if(action==='remove-benefit'){
        const row=button.closest('.hqr-benefit-block');
        row?.remove();
        const next=card.querySelector('[data-action="add-benefit"]');
        next?.focus({preventScroll:true});
      }
    });
    root.querySelector('[data-action="save"]')?.addEventListener('click',async()=>{
      if(this._saving)return;
      this._saving=true;
      const button=root.querySelector('[data-action="save"]');
      if(button)button.disabled=true;
      const scrollTop=root.querySelector('.hqr-scroll')?.scrollTop??0;
      try{
        assertGM();
        const oldName=this.doc?.name;
        const input=this._collect();
        const saved=await saveFaction(this.doc,input);
        this.doc=saved;
        this.ranks=normalizeFactionRanks(CLONE(saved.getFlag(ID,'ranks')));
        if(oldName!==saved.name)await renameFactionFolders(saved,oldName);
        ui.notifications.info('Faction saved.');
        await this.render();
        const pane=this.element.querySelector('.hqr-scroll');
        if(pane)pane.scrollTop=scrollTop;
        this.element.querySelector('[data-action="save"]')?.focus({preventScroll:true});
      }catch(error){report(error,'Save Faction failed');}
      finally{
        this._saving=false;
        const current=this.element?.querySelector('[data-action="save"]');
        if(current)current.disabled=false;
      }
    });
    root.querySelector('[data-action="open-journal"]')?.addEventListener('click',()=>this.doc?.sheet?.render(true));
  }
}
