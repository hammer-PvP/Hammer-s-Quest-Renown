import {ID,esc,eligible} from "../constants.mjs";
import {progressOf} from "../services/documents.mjs";

/** Adds a per-Character read-only outcome to the native Journal sheet.
 * The page text itself remains shared; no per-user Journal duplication or GM-secret disclosure.
 */
export function renderQuestStatus(app,html){
  const doc=app?.document;
  if(doc?.documentName!=="JournalEntry"||doc.getFlag(ID,"kind")!=="quest")return;
  const root=html?.[0]??html??app.element;
  if(!(root instanceof HTMLElement))return;
  const content=root.querySelector(".journal-entry-content, .journal-entry-page, .window-content");
  if(!content)return;
  let panel=root.querySelector("[data-hqr-quest-status]");
  if(!panel){
    panel=document.createElement("section");
    panel.className="hqr-personal-quest-state";panel.dataset.hqrQuestStatus="";
    content.prepend(panel);
  }
  // This is not a permission mechanism; a player sees only accessible Journal pages.
  const allowed=(doc.getFlag(ID,"assignees")??[]).map(id=>game.actors.get(id)).filter(actor=>
    actor?.type==="character"&&(game.user.isGM||Number(actor.ownership?.[game.user.id])===CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER));
  if(game.user.isGM){
    const progress=doc.getFlag(ID,"progress")??{};
    const done=allowed.filter(a=>progressOf(doc,a.id)==="completed").length;
    const failed=allowed.filter(a=>progressOf(doc,a.id)==="failed").length;
    panel.innerHTML=`<div class="hqr-status-for-gm"><img src="modules/${ID}/assets/book-feather.svg" alt=""><span>GM Overview: <strong>${done} Completed</strong> · <strong>${failed} Failed</strong> · ${allowed.length} Assigned</span></div>`;
    return;
  }
  if(!allowed.length){panel.remove();return;}
  let selected=panel.dataset.actorId;
  if(!allowed.some(a=>a.id===selected)){
    selected=(allowed.find(a=>a.id===game.user.character?.id)??allowed[0]).id;
  }
  function update(){
    const actor=allowed.find(a=>a.id===selected);
    if(!actor)return;
    const progress=progressOf(doc,actor.id);
    const stateLabel={completed:"QUEST COMPLETED",failed:"QUEST FAILED","in-progress":"IN PROGRESS",accepted:"QUEST ACCEPTED"};
    const stamp=progress==="completed"?"completed":progress==="failed"?"failed":null;
    const seal=stamp?`<img class="hqr-outcome-stamp" src="modules/${ID}/assets/quest-${stamp}.svg" alt="${esc(stateLabel[progress])}">`:"";
    const selector=allowed.length>1?`<label class="hqr-quest-character-selector">Character <select data-hqr-character>${allowed.map(a=>`<option value="${esc(a.id)}" ${a.id===selected?"selected":""}>${esc(a.name)}</option>`).join("")}</select></label>`:"";
    panel.className=`hqr-personal-quest-state hqr-state-${progress}`;
    panel.innerHTML=`${selector}<div class="hqr-status-line">${seal}<div class="hqr-status-caption"><strong>${esc(stateLabel[progress]??progress.toUpperCase())}</strong><span>${esc(actor.name)}</span>${progress==="failed"?"<small>This Quest was not completed before its opportunity expired.</small>":""}</div></div>`;
    panel.dataset.actorId=actor.id;
    panel.querySelector("[data-hqr-character]")?.addEventListener("change",event=>{selected=event.target.value;update();});
  }
  update();
}
