import {ID,DEFAULT_RANKS,assertGM,report,CLONE,factions} from "../constants.mjs";
import {saveFaction,getGMNotes,renameFactionFolders} from "../services/documents.mjs";
import {normalizeFactionRanks,newBenefitBlock} from "../services/rank-benefits.mjs";
import {getEnabledClasses} from "../services/class-catalog.mjs";
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;

/** Benefit lists retain source UUIDs; dragging from a World or Compendium
 * creates references here, never copies an Item until the GM issues a grant. */
function sourceNode(item){
  const row=document.createElement('div');row.className='hqr-benefit-source';
  row.dataset.sourceId=item.id??item.uuid;
  const image=document.createElement('img');image.src=item.img||'icons/svg/item-bag.svg';image.alt='';
  const label=document.createElement('span');label.textContent=item.name||item.uuid;
  label.title=item.uuid;
  const button=document.createElement('button');button.type='button';button.dataset.action='remove-source';
  button.title='Remove benefit source';button.innerHTML='<i class="fa-solid fa-trash"></i>';
  row.append(image,label,button);return row;
}
function slotNode(cls){
  const row=document.createElement('div');row.className='hqr-class-slot';row.dataset.classKey=cls.key;
  const title=document.createElement('strong');title.textContent=cls.name;
  const drop=document.createElement('div');drop.className='hqr-benefit-drop';drop.dataset.classKey=cls.key;
  drop.innerHTML='<span class="hqr-hint">Drop Items, Feats, Features or Spells</span><div class="hqr-benefit-sources"></div>';
  row.append(title,drop);
  if(cls.unavailable){row.classList.add('hqr-class-slot-unavailable');row.title='Class source is unavailable.';}
  return row;
}
function classSlotsNode(classes){
  const list=document.createElement('div');list.className='hqr-class-slot-list';
  if(!classes.length){const empty=document.createElement('p');empty.className='hqr-hint';
    empty.textContent='No classes enabled. Configure them in Module Settings.';list.append(empty);}
  for(const cls of classes)list.append(slotNode(cls));
  return list;
}
function benefitNode(block,classes=[]){
  const general=block.type==='general';
  const node=document.createElement('div');node.className='hqr-benefit-block';
  node.dataset.benefitId=block.id;node.dataset.benefitType=block.type;
  node.innerHTML=`<div class="hqr-benefit-head"><span><i class="fa-solid ${general?'fa-users':'fa-user-shield'}"></i> ${general?'General':'Class Specific'}</span><button type="button" data-action="remove-benefit" title="Remove block"><i class="fa-solid fa-xmark"></i></button></div>`;
  if(general){
    const drop=document.createElement('div');drop.className='hqr-benefit-drop';
    drop.innerHTML='<span class="hqr-hint">Drop Items, Feats, Features or Spells</span><div class="hqr-benefit-sources"></div>';
    node.append(drop);
  }else node.append(classSlotsNode(classes));
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
    this.ranks.push(fresh);
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
    this._mountBenefitSources();
    const count=root?.querySelector('[data-enabled-classes]');
    if(count)count.textContent=String(this.enabledClasses.length);
  }
  _mountBenefitSources(){
    const root=this.element;
    for(const rank of this.ranks){
      const card=[...root.querySelectorAll('.hqr-rank-card')].find(n=>n.dataset.rankId===rank.id);
      if(!card)continue;
      for(const block of rank.benefits??[]){
        const pane=[...card.querySelectorAll('.hqr-benefit-block')].find(n=>n.dataset.benefitId===block.id);
        if(!pane)continue;
        for(const drop of pane.querySelectorAll('.hqr-benefit-drop')){
          const list=drop.querySelector('.hqr-benefit-sources');if(!list)continue;
          const key=drop.dataset.classKey;
          const items=key?(block.classes?.[key]??[]):(block.items??[]);
          list.replaceChildren(...items.map(sourceNode));
        }
      }
    }
  }
  _onRender(){
    const root=this.element;
    this._mountBenefitSources();
    root.querySelector('.hqr-ranks')?.addEventListener('dragover',event=>{
      const drop=event.target.closest('.hqr-benefit-drop');
      if(drop){event.preventDefault();drop.classList.add('dragover');}
    });
    root.querySelector('.hqr-ranks')?.addEventListener('dragleave',event=>{
      const drop=event.target.closest('.hqr-benefit-drop');
      if(drop&&!drop.contains(event.relatedTarget))drop.classList.remove('dragover');
    });
    root.querySelector('.hqr-ranks')?.addEventListener('drop',async event=>{
      const drop=event.target.closest('.hqr-benefit-drop');if(!drop)return;
      event.preventDefault();event.stopPropagation();drop.classList.remove('dragover');
      try{
        const data=foundry.applications.ux.TextEditor?.implementation?.getDragEventData?.(event)
          ??JSON.parse(event.dataTransfer.getData('text/plain'));
        if(data.type!=='Item')throw new Error('Drop an Item from the World or a Compendium.');
        const uuid=data.uuid??(data.pack&&data.id?`Compendium.${data.pack}.Item.${data.id}`:data.id?`Item.${data.id}`:null);
        const source=uuid?await fromUuid(uuid):null;
        if(source?.documentName!=='Item')throw new Error('Unable to resolve that Item.');
        const card=drop.closest('.hqr-rank-card');const pane=drop.closest('.hqr-benefit-block');
        const rank=this.ranks.find(r=>r.id===card?.dataset.rankId);
        const block=rank?.benefits?.find(b=>b.id===pane?.dataset.benefitId);
        if(!block)throw new Error('Save the Faction before adding sources to this new block.');
        const classId=drop.dataset.classKey;
        const list=classId?(block.classes[classId]??=[]):block.items;
        if(list.some(row=>row.uuid===source.uuid)){ui.notifications.warn('This benefit is already present in this slot.');return;}
        const item={id:foundry.utils.randomID(),uuid:source.uuid,name:source.name,img:source.img,quantity:1};
        list.push(item);drop.querySelector('.hqr-benefit-sources')?.append(sourceNode(item));
      }catch(error){report(error,'Add rank benefit failed');}
    });
    root.querySelector('.hqr-ranks')?.addEventListener('click',event=>{
      const button=event.target.closest('button[data-action="remove-source"]');if(!button)return;
      const source=button.closest('.hqr-benefit-source');const drop=button.closest('.hqr-benefit-drop');
      const card=button.closest('.hqr-rank-card');const pane=button.closest('.hqr-benefit-block');
      const rank=this.ranks.find(r=>r.id===card?.dataset.rankId);
      const block=rank?.benefits?.find(b=>b.id===pane?.dataset.benefitId);
      if(!block)return;
      const classId=drop.dataset.classKey;
      const list=classId?block.classes?.[classId]:block.items;
      const index=list?.findIndex(x=>(x.id??x.uuid)===source.dataset.sourceId);
      if(index>=0){list.splice(index,1);source.remove();}
    });
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
          const rank=this.ranks.find(r=>r.id===card.dataset.rankId);
          if(rank)(rank.benefits??=[]).push(block);
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
