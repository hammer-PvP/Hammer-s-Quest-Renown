/** Local-only state for two independent Class Sources / Enabled Classes panels.
 * Source selection controls which definition UUIDs are authorized. Toggling a
 * source NEVER silently toggles class checkboxes or rerenders ApplicationV2.
 */
export function wireClassSourceControls(root){
  const sourceInputs=()=>[...root.querySelectorAll('input[data-class-source]')];
  const rows=()=>[...root.querySelectorAll('[data-class-row]')];
  const selectedSources=()=>new Set(sourceInputs().filter(i=>i.checked).map(i=>i.dataset.classSource));
  const search=root.querySelector('[data-class-search]');
  const update=()=>{
    const allowed=selectedSources(),query=String(search?.value??'').trim().toLocaleLowerCase();
    let visible=0;
    for(const row of rows()){
      const valid=[...row.querySelectorAll('[data-class-variant]')].filter(v=>allowed.has(v.dataset.sourceId));
      const caption=row.querySelector('[data-class-source-caption]');
      const input=row.querySelector('input[data-class-enable]');
      const count=valid.length;
      if(caption)caption.textContent=count?`${count} valid definition${count===1?'':'s'}`:'No authorized class definition';
      row.dataset.unavailable=count?'false':'true';
      // Source origin is available through a tooltip for inspection; the
      // compact list no longer repeats conflicting book names per class.
      const provenance=valid.map(v=>`${v.dataset.sourceLabel} (${v.dataset.sourceId})`).join(' · ');
      row.title=provenance||'No class document in the selected sources';
      const filterable=[row.dataset.name??'',provenance].join(' ').toLocaleLowerCase();
      row.hidden=!filterable.includes(query);
      if(!row.hidden)visible++;
      if(input)input.setAttribute('aria-describedby',caption?.id??'');
    }
    const enabled=root.querySelector('[data-class-count]');
    if(enabled)enabled.textContent=String(rows().filter(r=>r.querySelector('input[data-class-enable]')?.checked).length);
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
      for(const row of rows())if(!row.hidden)row.querySelector('input[data-class-enable]').checked=checked;
      update();
    });
  }
  update();
  return {update,collect(){return {
    selected:rows().filter(r=>r.querySelector('input[data-class-enable]')?.checked).map(r=>r.dataset.key),
    sourceIds:[...selectedSources()]
  };}};
}
