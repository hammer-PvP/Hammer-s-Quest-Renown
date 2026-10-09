import {ID,STATUS,CURRENCIES,assertGM,report,factions,eligible,groupMembers,CLONE,esc} from "../constants.mjs";
import {saveQuest,getGMNotes} from "../services/documents.mjs";
import {awardQuest} from "../services/reputation.mjs";
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
const defaults=()=>({name:"",factionUuid:"",status:"available",flavor:"",assignment:"group",groupId:game.actors.party?.id??"",assignees:[],objectives:[],items:[],currency:{pp:0,gp:0,ep:0,sp:0,cp:0},renown:0,renownScope:"group",lootRecipientId:"",notes:""});
export class QuestApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS={classes:["hqr-app","hqr-quest"],position:{width:1030,height:855},window:{title:"Quest Editor",resizable:true},tag:"section"};
  static PARTS={main:{template:`modules/${ID}/templates/quest.hbs`}};
  constructor(doc=null,options={}) {
    super(options); this.doc=doc;
    const stored=doc?.flags?.[ID]??{};
    this.data={...defaults(),...CLONE(stored),name:doc?.name??"",notes:doc?getGMNotes(doc):""};
  }
  async _prepareContext(){
    assertGM();
    const groups=game.actors.filter(a=>a.type==="group");
    const group=game.actors.get(this.data.groupId);
    const pcs=game.actors.filter(eligible);
    const assignedPcs=this.data.assignment==="group" ? groupMembers(group):pcs.filter(a=>this.data.assignees.includes(a.id));
    return {
      ...this.data, isEdit:!!this.doc, claimed:Boolean(this.doc?.getFlag(ID,"claimed")),
      groupMode:this.data.assignment!=="individual", renownGroup:this.data.renownScope!=="individual",
      factions:factions().map(f=>({uuid:f.uuid,name:f.name,selected:f.uuid===this.data.factionUuid})),
      groups:groups.map(g=>({id:g.id,name:g.name,selected:g.id===this.data.groupId})),
      statusOptions:STATUS.map(value=>({value,label:value.replaceAll("-"," ").replace(/^./,s=>s.toUpperCase()),selected:value===this.data.status})),
      participants:pcs.map(a=>({id:a.id,name:a.name,checked:this.data.assignees.includes(a.id)})),
      groupParticipants:groupMembers(group).map(a=>a.name),
      objectives:this.data.objectives.map((o,index)=>({...o,index})),
      items:this.data.items.map((item,index)=>({...item,index})),
      currencies:CURRENCIES.map(id=>({id,label:id.toUpperCase(),value:this.data.currency[id]??0})),
      lootActors:[...groups,...pcs].map(a=>({id:a.id,name:`${a.name} (${a.type})`,selected:a.id===this.data.lootRecipientId})),
      canAward:!!this.doc&&this.data.status==="completed"&&!this.doc.getFlag(ID,"claimed"),
      hasFac:factions().length>0
    };
  }
  _collect() {
    const r=this.element;
    const value=n=>r.querySelector(`[name="${n}"]`)?.value??"";
    this.data.name=value("name");this.data.factionUuid=value("factionUuid");
    this.data.status=value("status");this.data.flavor=value("flavor");
    this.data.assignment=value("assignment");this.data.groupId=value("groupId");
    this.data.assignees=Array.from(r.querySelectorAll('[name="assignees"]:checked')).map(e=>e.value);
    this.data.renownScope=value("renownScope");this.data.lootRecipientId=value("lootRecipientId");
    this.data.renown=Number(value("renown"))||0;
    this.data.notes=value("notes");
    this.data.currency=Object.fromEntries(CURRENCIES.map(k=>[k,Number(value(`currency_${k}`))||0]));
    this.data.objectives=Array.from(r.querySelectorAll(".hqr-objective")).map(el=>({text:el.querySelector("input[type=text]").value,done:el.querySelector("input[type=checkbox]").checked}));
    this.data.items=Array.from(r.querySelectorAll(".hqr-item-row")).map(el=>({uuid:el.querySelector('[data-field="uuid"]').value.trim(),name:el.querySelector('[data-field="label"]').value.trim(),quantity:Number(el.querySelector('[data-field="quantity"]').value)||1}));
    return this.data;
  }
  _onRender() {
    const r=this.element;
    r.querySelectorAll('[name="assignment"],[name="groupId"],[name="renownScope"]').forEach(el=>el.addEventListener("change",()=>{this._collect();this.render();}));
    r.querySelector('[data-action="add-objective"]')?.addEventListener("click",()=>{this._collect();this.data.objectives.push({text:"",done:false});this.render();});
    r.querySelectorAll('[data-action="remove-objective"]').forEach(button=>button.addEventListener("click",()=>{this._collect();this.data.objectives.splice(Number(button.dataset.index),1);this.render();}));
    r.querySelector('[data-action="add-item"]')?.addEventListener("click",()=>{this._collect();this.data.items.push({uuid:"",name:"",quantity:1});this.render();});
    r.querySelectorAll('[data-action="remove-item"]').forEach(button=>button.addEventListener("click",()=>{this._collect();this.data.items.splice(Number(button.dataset.index),1);this.render();}));
    r.querySelectorAll('[data-action="lookup-item"]').forEach(button=>button.addEventListener("click",async()=>{
      const row=button.closest(".hqr-item-row");
      try{const doc=await fromUuid(row.querySelector('[data-field="uuid"]').value.trim());
        if(doc?.documentName!=="Item") throw new Error("The UUID must reference a world or Compendium Item.");
        row.querySelector('[data-field="label"]').value=doc.name;
        ui.notifications.info(`Found Item: ${doc.name}`);
      }catch(err){report(err,"Item lookup failed");}
    }));
    r.querySelector('[data-action="save"]')?.addEventListener("click",async()=>{
      try{
        const data=this._collect();
        if(!data.factionUuid)throw new Error("Create or select a Faction first.");
        if(!data.name.trim())throw new Error("Quest name is required.");
        if(data.assignment==="group"&&!game.actors.get(data.groupId))throw new Error("Select a valid Group Actor.");
        if(data.assignment==="individual"&&!data.assignees.length)throw new Error("Select at least one eligible player character.");
        if(!data.objectives.every(x=>x.text.trim()))throw new Error("Remove or fill blank objectives.");
        if(!data.items.every(x=>x.uuid&&x.name))throw new Error("Reward Items require a valid UUID and name.");
        if(data.items.some(x=>Number(x.quantity)<1))throw new Error("Reward quantity must be 1 or greater.");
        if(data.renown && data.renownScope==="group" && !game.actors.get(data.groupId))throw new Error("Select a Group for group renown rewards.");
        const oldDoc=this.doc;
        this.doc=await saveQuest(this.doc,data);
        ui.notifications.info(oldDoc?"Quest updated.":"Quest created.");
        await this.render();
      }catch(error){report(error,"Save Quest failed");}
    });
    r.querySelector('[data-action="open-journal"]')?.addEventListener("click",()=>this.doc?.sheet?.render(true));
    r.querySelector('[data-action="award"]')?.addEventListener("click",async()=>{
      try{
        if(!this.doc) return;
        const confirmed=await foundry.applications.api.DialogV2.confirm({window:{title:"Grant Quest Rewards"},content:`<p>Grant the configured rewards for <strong>${esc(this.doc.name)}</strong>?</p><p>This will change Actor data and mark the Quest rewards as claimed. Save Quest changes first.</p>`,yes:{label:"Grant Rewards"},no:{label:"Cancel"}});
        if(!confirmed)return;
        await awardQuest(this.doc);await this.render();
      }catch(error){report(error,"Quest rewards failed");}
    });
    r.addEventListener("dragover",e=>{if(e.target.closest(".hqr-item-drop"))e.preventDefault();});
    r.addEventListener("drop",async e=>{
      if(!e.target.closest(".hqr-item-drop"))return;
      e.preventDefault();
      try{
        const payload=JSON.parse(e.dataTransfer.getData("text/plain"));
        if(payload.type!=="Item")return;
        const item=await fromUuid(payload.uuid??(payload.id?`Item.${payload.id}`:""));
        if(item?.documentName!=="Item")throw new Error("This is not a valid Item drop.");
        this._collect();this.data.items.push({uuid:item.uuid,name:item.name,quantity:1});await this.render();
      }catch(err){report(err,"Item drop failed");}
    });
  }
}
