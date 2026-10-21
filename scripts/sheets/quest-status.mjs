import {ID,esc,eligible} from "../constants.mjs";
import {progressOf,questFactionLabel} from "../services/documents.mjs";

/** Adds a per-Character read-only outcome to the native Journal sheet.
 * The page text itself remains shared; no per-user Journal duplication or GM-secret disclosure.
 */
export function renderQuestStatus(app,html){
  const source=app?.document??app?.object;
  const doc=source?.documentName==="JournalEntryPage"?source.parent:source;
  if(doc?.documentName!=="JournalEntry"||doc.getFlag(ID,"kind")!=="quest")return;
  if(source?.documentName==="JournalEntryPage" && source.getFlag(ID,"gmOnly"))return;
  const root=html?.[0]??html??app.element;
  if(!(root instanceof HTMLElement))return;
  // Never fall back to .window-content or the Journal chrome: V14 renders
  // full Journal sheets AND partial pages through different hooks. In v0.0.7
  // that fallback could insert a second stamp on top of the window controls.
  // Only the shared PUBLIC Quest Briefing HTML is a legal mount point.
  const questSections=[...(root.matches?.("section.hqr-journal")?[root]:[]),...root.querySelectorAll("section.hqr-journal")];
  // Never mount in the native Journal header, even when Foundry embeds a
  // fragment with a matching CSS class during a partial page render.
  const safeSections=questSections.filter(el=>!el.closest(".window-header, .window-controls, .window-title"));
  const content=safeSections.find(el=>el.offsetParent!==null)??safeSections[0];
  const existing=[...root.querySelectorAll("[data-hqr-quest-status]")];
  // Clean up orphaned stamp nodes left by earlier releases or interrupted
  // render cycles. A valid stamp lives INSIDE its private status section.
  for(const seal of root.querySelectorAll(".hqr-outcome-stamp")){
    if(!seal.closest("section.hqr-journal > section.hqr-personal-quest-state"))seal.remove();
  }
  if(!content){
    // Remove orphan panels left behind by a prior/partial render, but do not
    // create anything until the actual Quest Briefing has been mounted.
    for(const orphan of existing)orphan.remove();
    return;
  }
  let panel=existing.find(el=>el.parentElement===content)??null;
  const oldActorId=existing.find(el=>el.dataset.actorId)?.dataset.actorId;
  for(const orphan of existing)if(orphan!==panel)orphan.remove();
  if(!panel){
    panel=document.createElement("section");
    panel.className="hqr-personal-quest-state";panel.dataset.hqrQuestStatus="";
    // Mount directly inside the authored Quest page, just after the title.
    const heading=content.querySelector(":scope > h1");
    if(heading)heading.after(panel);else content.prepend(panel);
    if(oldActorId)panel.dataset.actorId=oldActorId;
  }
  // Legacy Quest Briefings store global availability. Display contextual status
  // without rewriting or migrating the shared Journal page content.
  const subtitle=content.querySelector(":scope > .hqr-journal-subtitle");
  const factionLabel=questFactionLabel(doc.getFlag(ID,"factionUuid"));
  if(subtitle)subtitle.textContent=game.user.isGM
    ? `${factionLabel} · ${doc.getFlag(ID,"status")==="inactive"?"Finished":doc.getFlag(ID,"status")??"Unavailable"}`
    : factionLabel;
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
    if(subtitle)subtitle.textContent=`${factionLabel} · ${progress==="in-progress"?"In Progress":progress.charAt(0).toUpperCase()+progress.slice(1)}`;
    const stateLabel={completed:"QUEST COMPLETED",failed:"QUEST FAILED","in-progress":"IN PROGRESS",accepted:"QUEST ACCEPTED"};
    const stamp=progress==="completed"?"completed":progress==="failed"?"failed":null;
    const seal=stamp?`<span class="hqr-outcome-stamp hqr-stamp-${stamp}" role="img" aria-label="${esc(stateLabel[progress])}"></span>`:"";
    const selector=allowed.length>1?`<label class="hqr-quest-character-selector">Character <select data-hqr-character>${allowed.map(a=>`<option value="${esc(a.id)}" ${a.id===selected?"selected":""}>${esc(a.name)}</option>`).join("")}</select></label>`:"";
    panel.className=`hqr-personal-quest-state hqr-state-${progress}`;
    panel.innerHTML=`${selector}<div class="hqr-status-line">${seal}<div class="hqr-status-caption"><strong>${esc(stateLabel[progress]??progress.toUpperCase())}</strong><span>${esc(actor.name)}</span>${progress==="failed"?"<small>This Quest was recorded as failed.</small>":""}</div></div>`;
    panel.dataset.actorId=actor.id;
    panel.querySelector("[data-hqr-character]")?.addEventListener("change",event=>{selected=event.target.value;update();});
  }
  update();
}
