import {ID,CURRENCIES,assertGM,report,factions,CLONE,esc} from "../constants.mjs";
import {saveQuest,getGMNotes} from "../services/documents.mjs";
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
const defaults=()=>({name:"",factionUuid:"",status:"unavailable",flavor:"",objectives:[],items:[],currency:{pp:0,gp:0,ep:0,sp:0,cp:0},renownRewards:[],notes:""});
function itemRow(item,index){
  const row=document.createElement("div");row.className="hqr-item-row";
  row.dataset.index=String(index);
  row.innerHTML=`<div class="hqr-item-label"><img alt="" class="hqr-item-img"><span class="hqr-item-name"></span><input type="hidden" data-field="uuid"></div><label class="hqr-qty">Qty.<input data-field="quantity" type="number" min="1" step="1"></label><button type="button" data-action="remove-item" title="Remove Item"><i class="fa-solid fa-trash"></i></button>`;
  row.querySelector('[data-field="uuid"]').value=item.uuid;
  row.querySelector('.hqr-item-name').textContent=item.name??"Item";
  row.querySelector('.hqr-item-img').src=item.img??'icons/svg/item-bag.svg';
  row.querySelector('[data-field="quantity"]').value=String(item.quantity??1);
  return row;
}
export class QuestApp extends HandlebarsApplicationMixin(ApplicationV2){
  static DEFAULT_OPTIONS={classes:["hqr-app","hqr-quest"],position:{width:950,height:815},window:{title:"Quest Editor",resizable:true},tag:"section"};
  static PARTS={main:{template:`modules/${ID}/templates/quest.hbs`}};
  constructor(doc=null,options={}){
    super(options);this.doc=doc;
    this.data={...defaults(),...CLONE(doc?.flags?.[ID]??{}),name:doc?.name??"",notes:doc?getGMNotes(doc):""};
  }
  async _prepareContext(){
    assertGM();
    return {...this.data,isEdit:!!this.doc,claimed:!!this.doc?.getFlag(ID,"claimed"),
      factions:factions().map(f=>({uuid:f.uuid,name:f.name,selected:f.uuid===this.data.factionUuid})),
      hasFac:factions().length>0,
      statusLabel:String(this.doc?.getFlag(ID,"status")??"unavailable").replaceAll("-"," "),
      objectives:this.data.objectives.map((o,index)=>({...o,index})),
      items:this.data.items.map((o,index)=>({...o,index,img:o.img||"icons/svg/item-bag.svg"})),
      renownRewards:(this.data.renownRewards??[]).map(row=>({...row,choices:factions().map(f=>({uuid:f.uuid,name:f.name,selected:f.uuid===row.factionUuid}))})),
      currencies:CURRENCIES.map(id=>({id,label:id.toUpperCase(),value:this.data.currency?.[id]??0}))};
  }
  _collect(){
    const r=this.element, value=n=>r.querySelector(`[name="${n}"]`)?.value??"";
    this.data.name=value("name");this.data.factionUuid=value("factionUuid");this.data.flavor=value("flavor");this.data.notes=value("notes");
    this.data.renownRewards=Array.from(r.querySelectorAll('.hqr-renown-reward')).map(row=>({
      id:row.dataset.rewardId, factionUuid:row.querySelector('[data-field="faction"]')?.value??"",
      amount:Number(row.querySelector('[data-field="amount"]')?.value)
    }));
    this.data.currency=Object.fromEntries(CURRENCIES.map(k=>[k,Number(value(`currency_${k}`))||0]));
    this.data.objectives=Array.from(r.querySelectorAll(".hqr-objective")).map(row=>({text:row.querySelector('input[type="text"]').value,done:row.querySelector('input[type="checkbox"]').checked}));
    this.data.items=Array.from(r.querySelectorAll(".hqr-item-row")).map(row=>({uuid:row.querySelector('[data-field="uuid"]').value,name:row.querySelector('.hqr-item-name').textContent,img:row.querySelector('.hqr-item-img').getAttribute('src'),quantity:Math.trunc(Number(row.querySelector('[data-field="quantity"]').value))}));
    return this.data;
  }
  _onRender(){
    const root=this.element;
    root.querySelector('[data-action="add-renown"]')?.addEventListener('click',()=>{
      if(this.doc?.getFlag(ID,'claimed'))return;
      const options=factions();
      const used=new Set([...root.querySelectorAll('.hqr-renown-reward [data-field="faction"]')].map(x=>x.value));
      const selected=options.find(f=>!used.has(f.uuid));
      if(!selected){ui.notifications.warn('All existing Factions have been added.');return;}
      const row=document.createElement('div'); row.className='hqr-renown-reward';
      row.dataset.rewardId=foundry.utils.randomID();
      const picker=document.createElement('select');picker.dataset.field='faction';
      for(const fac of options){const opt=document.createElement('option');opt.value=fac.uuid;opt.textContent=fac.name;opt.selected=fac.uuid===selected.uuid;picker.append(opt);}
      const amount=document.createElement('input');amount.type='number';amount.step='1';amount.value='0';amount.dataset.field='amount';
      const del=document.createElement('button');del.type='button';del.dataset.action='remove-renown';del.title='Remove Renown reward';
      del.innerHTML='<i class="fa-solid fa-trash"></i>';
      const wrapper=document.createElement('label');wrapper.className='hqr-renown-faction';wrapper.textContent='Faction';wrapper.append(picker);
      const amountLabel=document.createElement('label');amountLabel.className='hqr-renown-amount';amountLabel.textContent='Renown (+/-)';amountLabel.append(amount);
      row.append(wrapper,amountLabel,del);root.querySelector('.hqr-renown-rewards').append(row);
    });
    root.querySelector('.hqr-renown-rewards')?.addEventListener('click',event=>{
      const button=event.target.closest('[data-action="remove-renown"]');
      if(button&&!this.doc?.getFlag(ID,'claimed'))button.closest('.hqr-renown-reward')?.remove();
    });
    root.querySelector('[data-action="add-objective"]')?.addEventListener('click',()=>{
      const row=document.createElement('div');row.className='hqr-objective';
      row.innerHTML='<input type="checkbox" title="Completed"><input type="text" placeholder="Objective"><button type="button" data-action="remove-objective" title="Remove"><i class="fa-solid fa-trash"></i></button>';
      root.querySelector('.hqr-objectives').append(row);row.querySelector('input[type="text"]').focus();
    });
    root.querySelector('.hqr-objectives')?.addEventListener('click',e=>{
      const button=e.target.closest('[data-action="remove-objective"]');if(button) button.closest('.hqr-objective').remove();
    });
    root.querySelector('.hqr-items')?.addEventListener('click',e=>{
      const button=e.target.closest('[data-action="remove-item"]');if(button)button.closest('.hqr-item-row').remove();
    });
    const drop=root.querySelector('.hqr-item-drop');
    drop?.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('dragover');});
    drop?.addEventListener('dragleave',e=>{if(!drop.contains(e.relatedTarget))drop.classList.remove('dragover');});
    drop?.addEventListener('drop',async e=>{
      e.preventDefault();e.stopPropagation();drop.classList.remove('dragover');
      if(this.doc?.getFlag(ID,'claimed')){ui.notifications.warn("Rewards have already been issued for this Quest.");return;}
      try{
        const raw=e.dataTransfer?.getData('text/plain');
        const payload=foundry.applications.ux.TextEditor?.implementation?.getDragEventData?.(e)??JSON.parse(raw);
        if(payload.type!=="Item")throw new Error("Drag an Item from the directory or a Compendium.");
        const uuid=payload.uuid??(payload.pack&&payload.id?`Compendium.${payload.pack}.Item.${payload.id}`:payload.id?`Item.${payload.id}`:null);
        const item=uuid?await fromUuid(uuid):null;
        if(item?.documentName!=="Item")throw new Error("Unable to resolve the dropped Item.");
        const rows=root.querySelector('.hqr-items');
        const existing=Array.from(rows.querySelectorAll('.hqr-item-row')).find(row=>row.querySelector('[data-field="uuid"]').value===item.uuid);
        if(existing){const qty=existing.querySelector('[data-field="quantity"]');qty.value=String((Number(qty.value)||0)+1);}
        else rows.append(itemRow({uuid:item.uuid,name:item.name,img:item.img,quantity:1},rows.children.length));
      }catch(error){report(error,'Item drop failed');}
    });
    root.querySelectorAll('.hqr-item-row').forEach(row=>{row.querySelector('.hqr-item-name')?.setAttribute('title',row.querySelector('[data-field="uuid"]').value);});
    root.querySelector('[data-action="save"]')?.addEventListener('click',async()=>{
      try{
        const data=this._collect();
        if(!data.factionUuid)throw new Error("Select a Faction before saving.");
        if(!data.name.trim())throw new Error("Quest name is required.");
        if(!data.objectives.every(x=>x.text.trim()))throw new Error("Fill or remove empty objectives.");
        if(data.items.some(x=>!x.uuid||!x.name||!Number.isInteger(x.quantity)||x.quantity<1))throw new Error("Dropped Items must have a valid quantity.");
        if(CURRENCIES.some(k=>data.currency[k]<0||!Number.isInteger(data.currency[k])))throw new Error("Currency amounts must be non-negative whole numbers.");
        if(data.renownRewards.some(r=>!r.factionUuid || !Number.isInteger(r.amount)))throw new Error("Choose a Faction and an integer for every Renown reward.");
        if(new Set(data.renownRewards.map(r=>r.factionUuid)).size!==data.renownRewards.length)throw new Error("Each Faction can appear only once in Renown rewards.");
        const old=!!this.doc;
        this.doc=await saveQuest(this.doc,data);
        ui.notifications.info(old?"Quest saved.":"Quest created as Unavailable.");
        const scroll=root.querySelector('.hqr-scroll')?.scrollTop??0;
        await this.render();
        const newScroll=this.element.querySelector('.hqr-scroll');if(newScroll)newScroll.scrollTop=scroll;
      }catch(error){report(error,'Save Quest failed');}
    });
    root.querySelector('[data-action="open-journal"]')?.addEventListener('click',()=>this.doc?.sheet?.render(true));
    root.querySelector('[data-action="manage"]')?.addEventListener('click',async()=>{
      const {QuestManagerApp}=await import('./quest-manager-app.mjs');new QuestManagerApp().render(true);
    });
  }
}
