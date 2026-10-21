/** Local-only state for Class Sources / Enabled Classes (v0.1.9).
 * A source toggle changes visible eligibility, never the stored checkbox draft.
 * Hidden selections remain checked so restoring a source revives prior choices.
 * No ApplicationV2 rerender or World-setting write occurs before Save Settings.
 */
export function wireClassSourceControls(root){
  const sourceInputs=()=>[...root.querySelectorAll('input[data-class-source]')];
  const rows=()=>[...root.querySelectorAll('[data-class-row]')];
  const selectedSources=()=>new Set(sourceInputs().filter(i=>i.checked).map(i=>i.dataset.classSource));
  const search=root.querySelector('[data-class-search]');
  const update=()=>{
    const allowed=selectedSources(),query=String(search?.value??'').trim().toLocaleLowerCase();
    let visible=0,available=0,enabled=0;
    for(const row of rows()){
      const valid=[...row.querySelectorAll('[data-class-variant]')].filter(v=>allowed.has(v.dataset.sourceId));
      const caption=row.querySelector('[data-class-source-caption]');
      const input=row.querySelector('input[data-class-enable]');
      const count=valid.length;
      const eligible=count>0;
      if(caption)caption.textContent=eligible?`${count} valid definition${count===1?'':'s'}`:'No authorized class definition';
      row.dataset.unavailable=eligible?'false':'true';
      const provenance=valid.map(v=>`${v.dataset.sourceLabel} (${v.dataset.sourceId})`).join(' · ');
      row.title=provenance||'No class document in the selected sources';
      const filterable=[row.dataset.name??'',provenance].join(' ').toLocaleLowerCase();
      // Exclude source-ineligible and missing/orphan classes from the list,
      // but retain their checked draft in the DOM and on Save.
      row.hidden=!eligible||!filterable.includes(query);
      if(eligible){available++;if(input?.checked)enabled++;}
      if(!row.hidden)visible++;
      if(input)input.setAttribute('aria-describedby',caption?.id??'');
    }
    const selectedCount=root.querySelector('[data-class-count]');
    if(selectedCount)selectedCount.textContent=String(enabled);
    const availableCount=root.querySelector('[data-class-available-count]');
    if(availableCount)availableCount.textContent=String(available);
    const sourceCount=root.querySelector('[data-source-count]');
    if(sourceCount)sourceCount.textContent=String(allowed.size);
    const visibleCount=root.querySelector('[data-class-visible-count]');
    if(visibleCount)visibleCount.textContent=String(visible);
  };
  for(const source of sourceInputs())source.addEventListener('change',update);
  search?.addEventListener('input',update);
  root.querySelector('[data-class-list]')?.addEventListener('change',update);
  for(const [action,checked] of [['select-all-classes',true],['clear-classes',false]]){
    root.querySelector(`[data-action="${action}"]`)?.addEventListener('click',()=>{
      for(const row of rows())if(!row.hidden){
        const input=row.querySelector('input[data-class-enable]');
        if(input)input.checked=checked;
      }
      update();
    });
  }
  update();
  return {update,collect(){return {
    // Includes dormant checked classes even when their sources are disabled;
    // getEnabledClasses filters eligibility instead of deleting World choices.
    selected:rows().filter(r=>r.querySelector('input[data-class-enable]')?.checked).map(r=>r.dataset.key),
    sourceIds:[...selectedSources()]
  };}};
}
