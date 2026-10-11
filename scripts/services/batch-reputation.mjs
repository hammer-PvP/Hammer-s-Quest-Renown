/**
 * v0.0.6 additive transaction coordinator. Never rewrites legacy Actor ledgers.
 * A durable world setting freezes the intended recipients before the first Actor
 * changes; each recipient has a deterministic ledger key for safe retry.
 */
import {ID, assertGM, eligible} from "../constants.mjs";
import {getFaction, reconcileAccess} from "./documents.mjs";
import {adjust, historyFor} from "./reputation.mjs";

export const BATCH_SETTING = "pendingRenownBatch";
export const SCHEMA_SETTING = "dataVersion";
export const SCHEMA_VERSION = 1;
let running = false;
export const isRenownBatchRunning = () => running;

export function registerReputationSettings() {
  game.settings.register(ID, SCHEMA_SETTING, {
    name: "Hammer's Quest & Renown Data Version", scope: "world", config: false,
    type: Number, default: 0
  });
  game.settings.register(ID, BATCH_SETTING, {
    name: "Pending Manual Renown Batch", scope: "world", config: false,
    type: Object, default: {}
  });
}

/** Additive/idempotent migration. v0.0.5 Actor ledgers remain byte-for-byte intact. */
export async function migrateReputationSchema() {
  assertGM();
  const current = Number(game.settings.get(ID, SCHEMA_SETTING) ?? 0);
  if (!Number.isInteger(current) || current < 0 || current > SCHEMA_VERSION)
    throw new Error(`Unsupported Renown data version: ${current}. No data was changed.`);
  if (current === SCHEMA_VERSION) return false;
  // The new durable pending-batch setting already has an empty default.
  // No Actor or Journal is changed during this versioned upgrade.
  await game.settings.set(ID, SCHEMA_SETTING, SCHEMA_VERSION);
  return true;
}

export function getPendingRenownBatch() {
  const plan = game.settings.get(ID, BATCH_SETTING) ?? {};
  return typeof plan?.id === "string" && Array.isArray(plan.actorIds) ? plan : null;
}

function validateInput({actorIds, factionUuid, delta, reason}) {
  const ids = [...new Set(actorIds ?? [])];
  if (!ids.length) throw new Error("Select at least one Character or Group Actor.");
  const targets = ids.map(id => game.actors.get(id));
  if (targets.some(a => !a || (a.type === "character" ? !eligible(a) : a.type !== "group")))
    throw new Error("One or more recipients are no longer eligible. Refresh the manager.");
  if (!getFaction(factionUuid)) throw new Error("Choose an existing Faction.");
  if (!Number.isInteger(delta) || !Number.isSafeInteger(delta))
    throw new Error("Renown change must be a safe whole number (zero is allowed).");
  const trimmed = String(reason ?? "").trim();
  if (!trimmed) throw new Error("A reason is required.");
  return {ids, trimmed};
}

/**
 * Resume an interrupted batch by calling with no details. Pending snapshots
 * cannot be edited or replaced: resume first. No second batch can start until
 * the first is durably completed. Same client cannot interleave calls.
 */
export async function applyRenownBatch(details = null) {
  assertGM();
  if (running) throw new Error("A Renown batch is already being applied in this client.");
  running = true;
  try {
    let plan = getPendingRenownBatch();
    if (plan && details) throw new Error("An interrupted batch exists. Resume it before starting another adjustment.");
    if (!plan) {
      if (!details) throw new Error("There is no pending batch to resume.");
      const delta = Number(details.delta);
      const {ids, trimmed} = validateInput({...details, delta});
      plan = {
        schema: SCHEMA_VERSION, id: foundry.utils.randomID(),
        actorIds: ids, factionUuid: details.factionUuid, delta,
        reason: trimmed, at: new Date().toISOString(), gmUserId: game.user.id
      };
      // Commit intent BEFORE touching any Actor to survive F5/restart.
      await game.settings.set(ID, BATCH_SETTING, plan);
    }
    if (plan.schema !== SCHEMA_VERSION || !Array.isArray(plan.actorIds) || !plan.id)
      throw new Error("Pending batch format is unknown. Do not clear it; contact the maintainer.");
    if (!getFaction(plan.factionUuid))
      throw new Error("The pending batch references a missing Faction. Restore it before retrying.");
    if (!Number.isSafeInteger(plan.delta) || !String(plan.reason??"").trim())
      throw new Error("Pending batch payload is invalid. No new changes were applied.");

    let added = 0;
    for (const id of plan.actorIds) {
      const actor = game.actors.get(id);
      if (!actor || !["character", "group"].includes(actor.type))
        throw new Error(`Recipient ${id} no longer exists. Restore the Actor before retrying.`);
      // The immutable recipient key makes this idempotent even if the previous
      // session stopped just after actor.setFlag but before world-setting cleanup.
      const key = `manual-batch:${plan.id}:${id}`;
      if (historyFor(actor).some(row => row.key === key)) continue;
      if (await adjust(actor, plan.factionUuid, plan.delta, plan.reason,
        {source: "manual", key, reconcile: false})) added++;
    }
    await reconcileAccess();
    await game.settings.set(ID, BATCH_SETTING, {});
    return {recipients: plan.actorIds.length, newlyRecorded: added, id: plan.id};
  } finally { running = false; }
}
