import {ID,assertGM,report,esc} from "../constants.mjs";
import {failedCharacters,reversibleGroups,pendingFailureReversal,undoQuestFailure} from "../services/failure-reversal.mjs";
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;

/** GM-only correction UI. Nothing is committed until explicit confirmation. */
export class FailureReversalApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS={classes:["hqr-app","hqr-undo-failure"],
    position:{width:740,height:700},window:{title:"Undo Quest Failure",resizable:true},tag:"section"};
  static PARTS={main:{template:`modules/${ID}/templates/failure-reversal.hbs`}};
  constructor(doc,options={}){super(options);this.doc=doc;this.characterIds=[];this.groupIds=[];this.reason="";}
  async _prepareContext(){
    assertGM();
    const pending=pendingFailureReversal(this.doc);
    const failed=failedCharacters(this.doc);
    const allowed=new Set(failed.map(c=>c.id));
    this.characterIds=this.characterIds.filter(id=>allowed.has(id));
    const groups=reversibleGroups(this.doc,this.characterIds);
    this.groupIds=this.groupIds.filter(id=>groups.some(g=>g.id===id&&g.available));
    return {name:this.doc.name,pending:!!pending,pendingCharacters:pending?.characters?.length??0,
      pendingGroups:pending?.groups?.length??0,hasFailed:failed.length>0,
      characters:failed.map(c=>({...c,checked:this.characterIds.includes(c.id)})),
      selectedCount:this.characterIds.length,total:failed.length,
      groups:groups.map(g=>({...g,checked:this.groupIds.includes(g.id)})),
      hasGroups:groups.length>0,selectedGroups:this.groupIds.length,reason:this.reason};
  }
  _onRender(){
    const root=this.element;
    const list=name=>[...root.querySelectorAll(`[name="${name}"]:checked:not(:disabled)`)].map(x=>x.value);
    root.querySelectorAll('[name="undoCharacters"]').forEach(el=>el.addEventListener("change",async()=>{
      this.characterIds=list("undoCharacters");await this._refreshPreservingScroll();
    }));
    root.querySelector('[data-action="all"]')?.addEventListener("click",async()=>{
      this.characterIds=failedCharacters(this.doc).map(c=>c.id);await this._refreshPreservingScroll();
    });
    root.querySelector('[data-action="clear"]')?.addEventListener("click",async()=>{
      this.characterIds=[];this.groupIds=[];await this._refreshPreservingScroll();
    });
    root.querySelectorAll('[name="undoGroups"]').forEach(el=>el.addEventListener("change",()=>{
      this.groupIds=list("undoGroups");this._updateSubmit();
    }));
    root.querySelector('[name="undoReason"]')?.addEventListener("input",e=>{
      this.reason=e.target.value;this._updateSubmit();
    });
    root.querySelector('[data-action="undo"]')?.addEventListener("click",async()=>{
      try {
        const pending=pendingFailureReversal(this.doc);
        if(!pending && (!this.characterIds.length || !this.reason.trim()))throw new Error("Select Failed Characters and provide a correction reason.");
        const content=pending
          ? `<p>Resume the interrupted reversal of <strong>${pending.characters.length} Character(s)</strong> for <strong>${esc(this.doc.name)}</strong>?</p><p>Already-compensated penalties will not be applied again.</p>`
          : `<p>Restore <strong>${this.characterIds.length} Character(s)</strong> from Failed to their previous (or Accepted) status in <strong>${esc(this.doc.name)}</strong>?</p><p>Also reverse penalties for <strong>${this.groupIds.length} explicitly selected Group(s)</strong>. Any applicable Renown penalties will receive compensating transactions, without deleting history.</p><p><strong>Reason:</strong> ${esc(this.reason)}</p>`;
        const confirmed=await foundry.applications.api.DialogV2.confirm({window:{title:pending?"Resume Undo Failure":"Confirm Undo Failure"},
          content,yes:{label:pending?"Resume Correction":"Undo Selected Failures"},no:{label:"Cancel"}});
        if(!confirmed)return;
        await undoQuestFailure(this.doc,{characterIds:this.characterIds,groupIds:this.groupIds,reason:this.reason});
        this.characterIds=[];this.groupIds=[];this.reason="";
        await this.render();
      }catch(error){report(error,"Undo Failure failed");}
    });
    this._updateSubmit();
  }
  _updateSubmit(){
    const button=this.element.querySelector('[data-action="undo"]');
    if(button)button.disabled=!pendingFailureReversal(this.doc)&&(!this.characterIds.length||!this.reason.trim());
  }
  async _refreshPreservingScroll(){
    const parent=this.element.querySelector(".hqr-scroll");const top=parent?.scrollTop??0;
    await this.render();const next=this.element.querySelector(".hqr-scroll");if(next)next.scrollTop=top;
  }
}
