/** DOM-local Class Sources / Class Catalog interaction. Never rerenders AppV2. */
export function wireClassSourceControls(root){
  const sourceInputs=()=>[...root.querySelectorAll('input[data-class-source]')];
  const rows=()=>[...root.querySelectorAll('[data-class-row]')];
  const selectedSources=()=>new Set(sourceInputs().filter(i=>i.checked).map(i=>i.dataset.classSource));
  const search=root.querySelector('[data-class-search]');
  let sourceChanged=false;
  const update=()=>{
    const allowed=selectedSources(),query=String(search?.value??'').trim().toLocaleLowerCase();
    for(const row of rows()){
      const input=row.querySelector('input[data-class-enable]');
      const select=row.querySelector('select[data-class-definition]');
      const options=[...select.options].filter(o=>o.value);
      let available=[];
      for(const option of options){
        const permitted=allowed.has(option.dataset.sourceId);
        option.disabled=!permitted;option.hidden=!permitted;
        if(permitted)available.push(option);
      }
      if(select.value && !available.some(o=>o.value===select.value))select.value='';
      // A single permissible definition is unambiguous and safe to resolve.
      if(!select.value && available.length===1 && (sourceChanged || row.dataset.pinnedUnavailable!=='true'))select.value=available[0].value;
      const current=available.find(o=>o.value===select.value);
      const caption=row.querySelector('[data-class-source-caption]');
      if(caption)caption.textContent=current?.dataset.sourceLabel??(available.length>1?'Choose exact class definition':available.length?'Source available':'No enabled source');
      const hasChoices=available.length>1;
      select.hidden=!hasChoices;
      row.dataset.ambiguous=!!available.length&&!select.value?'true':'false';
      row.dataset.unavailable=!available.length?'true':'false';
      const searchable=[row.dataset.name??'',...available.map(o=>o.textContent)].join(' ').toLocaleLowerCase();
      row.hidden=(!available.length&&!input.checked)||!searchable.includes(query);
    }
    const count=root.querySelector('[data-class-count]');
    if(count)count.textContent=String(rows().filter(r=>r.querySelector('input[data-class-enable]')?.checked).length);
    const sourceCount=root.querySelector('[data-source-count]');
    if(sourceCount)sourceCount.textContent=String(allowed.size);
  };
  for(const source of sourceInputs())source.addEventListener('change',()=>{sourceChanged=true;update();});
  search?.addEventListener('input',update);
  root.querySelector('[data-class-list]')?.addEventListener('change',update);
  for(const [action,checked] of [['select-all-classes',true],['clear-classes',false]]){
    root.querySelector(`[data-action="${action}"]`)?.addEventListener('click',()=>{
      for(const row of rows())if(!row.hidden)row.querySelector('input[data-class-enable]').checked=checked;
      update();
    });
  }
  // Current DOM values are authoritative. No drafts are mutated when opening
  // or closing <details>; source changes only affect definitions in the UI.
  update();
  return {
    update,
    collect(){return {
      selected:rows().filter(r=>r.querySelector('input[data-class-enable]')?.checked).map(r=>r.dataset.key),
      sourceIds:[...selectedSources()],
      bindings:Object.fromEntries(rows().map(r=>[r.dataset.key,r.querySelector('select[data-class-definition]')?.value??'']))
    };}
  };
}
