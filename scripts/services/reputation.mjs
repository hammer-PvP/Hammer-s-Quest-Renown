import {ID,assertGM,eligible,groupMembers,ownerUsers,CURRENCIES,rankFor} from "../constants.mjs";
import {getFaction,reconcileAccess} from "./documents.mjs";

export function reputationOf(actor,factionUuid) {
  return (actor?.getFlag(ID,"ledger")??[]).filter(row=>row.factionUuid===factionUuid).reduce((s,r)=>s+Number(r.delta||0),0);
}
export function historyFor(actor) { return actor?.getFlag(ID,"ledger")??[]; }
export async function adjust(actor,factionUuid,delta,reason,{source="manual",key=null}={}) {
  assertGM();
  if (!actor || !["group","character"].includes(actor.type)) throw new Error("Choose a Character or Group Actor.");
  if (!getFaction(factionUuid)) throw new Error("Choose an existing Faction.");
  if(!Number.isInteger(Number(delta))) throw new Error("Renown must be an integer.");
  if(!String(reason??"").trim()) throw new Error("A reason is required.");
  const rows=historyFor(actor);
  if(key && rows.some(row=>row.key===key)) return false;
  const row={ id:foundry.utils.randomID(), key:key??foundry.utils.randomID(),factionUuid,
    delta:Number(delta),reason:String(reason).trim(),source,at:new Date().toISOString(), gmUserId:game.user.id };
  await actor.setFlag(ID,"ledger",[...rows,row]);
  await reconcileAccess();
  return true;
}
function participants(doc) {
  if(doc.getFlag(ID,"assignment")==="group") return groupMembers(game.actors.get(doc.getFlag(ID,"groupId")));
  return (doc.getFlag(ID,"assignees")??[]).map(id=>game.actors.get(id)).filter(eligible);
}
export async function awardQuest(doc) {
  assertGM();
  if(doc?.getFlag(ID,"kind")!=="quest") throw new Error("Not a Quest journal.");
  if(doc.getFlag(ID,"claimed")) throw new Error("This Quest has already had its rewards issued.");
  if(doc.getFlag(ID,"status")!=="completed") throw new Error("Mark the Quest Completed before issuing rewards.");
  const renown=Number(doc.getFlag(ID,"renown")??0);
  const factionUuid=doc.getFlag(ID,"factionUuid");
  const scope=doc.getFlag(ID,"renownScope")??"group";
  let renownActors=[];
  if(renown && !getFaction(factionUuid)) throw new Error("Renown rewards require a valid Faction.");
  if(renown) {
    const group=game.actors.get(doc.getFlag(ID,"groupId"));
    if(scope==="group") {
      if(!group || group.type!=="group") throw new Error("Party Renown requires an assigned Group Actor.");
      renownActors=[group];
    } else renownActors=participants(doc);
    if(!renownActors.length) throw new Error("No eligible recipients for Renown.");
  }
  const currencies=doc.getFlag(ID,"currency")??{};
  const items=doc.getFlag(ID,"items")??[];
  const hasLoot=CURRENCIES.some(k=>Number(currencies[k])>0) || items.length>0;
  const recipient=game.actors.get(doc.getFlag(ID,"lootRecipientId"));
  if(hasLoot && (!recipient || !["character","group"].includes(recipient.type))) throw new Error("Select an inventory recipient for the currency and items.");
  // Granular idempotency: ledger key for renown, one atomic currency update, source ID for each embedded Item.
  for(const actor of renownActors) {
    await adjust(actor,factionUuid,renown,`Quest completed: ${doc.name}`,{source:doc.uuid,key:`quest:${doc.uuid}:renown:${actor.id}`});
  }
  if(hasLoot) {
    const key=`quest:${doc.uuid}:currency`;
    const paid=recipient.getFlag(ID,"paidCurrency")??[];
    if(!paid.includes(key)) {
      const updates={ [`flags.${ID}.paidCurrency`]:[...paid,key] };
      for(const denomination of CURRENCIES) {
        const amount=Math.max(0,Math.trunc(Number(currencies[denomination])||0));
        if(amount) updates[`system.currency.${denomination}`]=Number(recipient.system?.currency?.[denomination]??0)+amount;
      }
      await recipient.update(updates);
    }
    for(let i=0;i<items.length;i++) {
      const reward=items[i]; if(!reward.uuid) continue;
      const itemKey=`quest:${doc.uuid}:item:${i}`;
      if(recipient.items.some(x=>x.getFlag(ID,"rewardKey")===itemKey)) continue;
      const source=await fromUuid(reward.uuid);
      if(!source || source.documentName!=="Item") throw new Error(`Reward Item not found: ${reward.uuid}`);
      const data=source.toObject();
      delete data._id;
      data.system??={};
      data.system.quantity=Math.max(1,Math.trunc(Number(reward.quantity)||1));
      data.flags??={}; data.flags[ID]={...(data.flags[ID]??{}), rewardKey:itemKey};
      await recipient.createEmbeddedDocuments("Item",[data]);
    }
  }
  await doc.setFlag(ID,"claimed",true);
  ui.notifications.info(`Rewards issued for ${doc.name}.`);
  return true;
}
