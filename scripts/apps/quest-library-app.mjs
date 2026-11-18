import {ID,assertGM,report} from '../constants.mjs';
import {exportQuestLibrary,importQuestLibrary} from '../services/quest-library.mjs';
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
export class QuestLibraryApp extends HandlebarsApplicationMixin(ApplicationV2){
  static DEFAULT_OPTIONS={classes:['hqr-app','hqr-library'],position:{width:610,height:480},window:{title:'Quest & Faction Library',resizable:true},tag:'section'};
  static PARTS={main:{template:`modules/${ID}/templates/quest-library.hbs`}};
  async _prepareContext(){assertGM();return {};}
  _onRender(){
    const root=this.element;
    root.querySelector('[data-action="export"]')?.addEventListener('click',async()=>{
      try{const content=JSON.stringify(await exportQuestLibrary(),null,2);
        saveDataToFile(content,'application/json','hammer-s-quest-renown-library.json');
      }catch(error){report(error,'Export failed');}
    });
    root.querySelector('[data-action="import"]')?.addEventListener('click',async event=>{
      const file=root.querySelector('input[type="file"]')?.files?.[0];
      if(!file){ui.notifications.warn('Select a JSON library first.');return;}
      const button=event.currentTarget;button.disabled=true;
      try{
        if(file.size>40*1024*1024)throw new Error('The selected file is too large.');
        const data=JSON.parse(await file.text());
        const yes=await foundry.applications.api.DialogV2.confirm({window:{title:'Import Quests & Factions'},
          content:`<p>Import <strong>${Number(data.factions?.length)||0} Factions</strong> and <strong>${Number(data.quests?.length)||0} Quest definitions</strong>?</p><p>New Journal IDs will be created. Existing World content will not be overwritten. Player assignments, payouts, Actor ledgers and result history are not imported.</p><p>Use a World backup before importing. ${root.querySelector('[name="applySettings"]')?.checked?'World configuration settings will also be applied.':'World settings will not be altered.'}</p>`,
          yes:{label:'Import Library'},no:{label:'Cancel'}});
        if(!yes)return;
        const applySettings=!!root.querySelector('[name="applySettings"]')?.checked;
        const result=await importQuestLibrary(data,{applySettings});
        ui.notifications.info(`Imported ${result.createdFactions} Factions, ${result.createdQuests} Quests and ${result.createdItems} Item sources; ${result.skippedFactions+result.skippedQuests} existing library records skipped.`);
      }catch(error){report(error,'Import failed');}
      finally{button.disabled=false;}
    });
  }
}
