# Hammer's Quest & Renown

Manage Quests, Factions, Renown, and rank benefits for **Foundry Virtual Tabletop V14** and **D&D5e**. The module uses native Journal entries for Quests and Factions, and records each Character's or Group's Renown separately. The interface is in English.

## Features

- **Factions and ranks:** create Faction profiles, configure Renown thresholds, and organize General and Class Specific benefits.
- **Rank benefit grants:** drag Items, Feats, Features, and Spells into rank benefit blocks; a GM can grant eligible benefits to selected Characters through the Reputation Manager. Previously granted benefits are not duplicated automatically.
- **Quests:** create Quests with or without an owner Faction, distribute them to Characters, and record individual Accepted, Completed, or Failed outcomes.
- **Objectives:** choose shared progress or separate progress for each assigned Character. The GM manages completion; players can view their personal progress in the Quest Journal.
- **Individual rewards:** customize currency, Item quantities, and Renown for each selected Character during Success Turn-In. Represented Groups may receive separate Renown when explicitly selected.
- **Failure penalties:** apply negative Renown and optionally forfeit currency or matching inventory Items. Undo Failure records compensating changes and restores recorded forfeitures.
- **Undo Success:** reverse a completed Turn-In after checking whether the paid currency and original awarded Items can be recovered safely. Renown corrections are recorded without erasing the original history.
- **Duplicate Quest:** make a reusable, unavailable copy without importing participants or payout history.
- **Quest & Faction Library:** export and import reusable definitions as JSON between Worlds, including referenced Item sources when possible.
- **Reputation Manager and sheet integration:** view and adjust personal or Group Renown. Supported native D&D5e sheets include a Reputation tab.
- **Journal organization:** GM Only, Active, and Finished folders track the Quest's global administrative status without altering individual outcomes.
- **Protected deletion:** delete disposable Quests only when no final results, payments, or pending transactions block deletion.

## Compatibility

| Component | Range |
| --- | --- |
| Foundry Virtual Tabletop | V14, minimum build `14.367` |
| D&D5e game system | Minimum `6.0.0`; intended range through `6.1.x` |
| Additional modules | Character Builder is not required |

Compatibility shown here describes the manifest's allowed range. Always back up your World and test new Foundry and D&D5e versions before using them in a live campaign.

The module's Reputation system is **independent of the D&D5e 6.1 native Faction/Renown feature**. It does not migrate or import native Faction Actors or native Renown Items.

## Installation

1. Open **Foundry Setup → Add-on Modules → Install Module**.
2. Enter the manifest URL:

   ```text
   https://github.com/hammer-PvP/Hammer-s-Quest-Renown/releases/latest/download/module.json
   ```

3. Enable **Hammer's Quest & Renown** in your D&D5e World.
4. As GM, open the **Journal Directory**. Its HQR controls appear in a separate row under Foundry's Create Entry and Create Folder buttons: **Factions**, **Quest Manager**, and the icon-only **Renown** control.

For manual installation, place the contents of the release ZIP in `Data/modules/hammer-s-quest-renown/`, with `module.json` directly inside that folder. Close Foundry and back up the World before replacing an installed module.

## Quick start

1. Open **Factions** to create an organization and its Renown ranks, if needed.
2. Open **Quest Manager → Create Quest**. Select an Owner Faction or **No Faction — Independent Quest**. Add the briefing, objectives, and rewards, then save.
3. Select **Make Available**, then **Quest Giving** to assign the Quest to player-owned Characters.
4. Open **Objectives** to record shared or Character-specific progress. Completing objectives does not automatically finish the Quest.
5. Use **Quest Turn-In** for successful Characters, or **Fail Turn-In** for those who failed. Each Character's outcome remains independent.
6. Use **View Results** to review outcomes and transactions. **Finish Quest** closes the Quest administratively without automatically changing Characters' results.

### Quests and Factions

One Quest is one shared native Journal. The optional Owner Faction is a reference, not a folder. Renown reward and penalty rows target their own real Factions, independently from the owner. You may change the Owner Faction after distribution or payouts without rewriting history. A missing owner reference is displayed as **Missing Faction**, not silently converted to an independent Quest.

Quests have a public briefing and a separate, private **GM Notes** page. A player's personalized status is visible only through Journals the player is permitted to open. Foundry Journal access is granted to Users rather than individual Characters.

### Objectives

The Quest Editor offers two modes:

- **Shared across all Characters:** all participants see the same completed or incomplete objectives.
- **Separate for each Character:** the GM selects a recipient in **Quest Manager → Objectives** and checks progress for that Character. The player's Quest Journal shows **My Objectives** for the currently selected owned Character.

Objectives are informational. Their checkboxes do not automatically complete a Quest, distribute rewards, or change a Character's Accepted/Completed/Failed state.

### Success Turn-In and individual rewards

In **Quest Manager → Quest Turn-In**, choose unfinished assigned Characters. You may override currency amounts, Item quantities (including zero), and Renown rewards for each selected Character. Each chosen Character receives their specified amounts; unmodified fields use the Quest's configured values. Represented Group Renown is separate, applied once per selected Group, and is never automatically inferred from Group membership.

A saved payout transaction can be resumed if interrupted. Do not run a fresh payout to compensate for an interrupted one. Paid reward definitions are locked to protect existing records.

### Failure Turn-In and forfeitures

The **Failure Penalties** section of the Quest Editor is GM-only and optional. It may contain negative Faction Renown, coins to forfeit in each denomination, and Item definitions to confiscate in specific quantities.

For Item forfeitures, an assigned Character must have **exactly one matching Item stack** of the same name and type, with enough quantity. Coins must also be available. The operation will refuse a material forfeiture if the requirements are not met; the GM may uncheck **Apply configured Currency and Item forfeitures** during Failure Turn-In to record the failure and any Renown penalty without confiscating material resources.

**Undo Failure** restores the previous unfinished state when available, restores currency and Item quantities that were actually confiscated, and offsets recorded negative Renown through new ledger events. It does not erase the original history or reopen a globally Finished Quest.

### Undo Success

A GM can open **Undo Success** for a Quest with completed Characters and recorded payouts, select recipients, and provide a reason. The module checks that the Character still has the necessary coins and the original awarded Item instances, in the expected quantities and not equipped. If an Item was used, modified, or is missing, restore the original inventory conditions before reversing.

When eligible, the correction withdraws the recorded currency and awarded Item instances, writes compensating Renown entries, and restores those Characters to **Accepted**. Original payout records remain available for audit. The GM can optionally reverse eligible Group Renown. The Quest itself is not reopened automatically; use **Reopen (Available)** separately if it was Finished.

For interrupted operations, use the available **Resume** control instead of creating a new correction.

## Factions, ranks, and benefits

Create or edit a Faction using **Factions** in the Journal Directory. Each Faction has an image, public description, optional private GM Notes, and editable Renown ranks.

In a rank, add **General** blocks (available to eligible Characters regardless of class) or **Class Specific** blocks (one logical slot per enabled class). **Drag Items from World Items or Compendiums into the appropriate block**, and set quantities. This works for Items, Feats, Features, and Spells that Foundry exposes as Item documents.

To configure class eligibility, open **Game Settings → Configure Settings → Module Settings → Hammer's Quest & Renown → Open Settings**. Select permitted **Class Sources**, then **Enabled Classes**. The same logical class from multiple authorized sources shares one slot. Disabling a source hides unavailable slots but does not erase previously saved benefit definitions.

To actually grant benefits:

1. Open **Renown** (Reputation Manager).
2. Select the recipient Character(s) and the target Faction.
3. Choose **Grant Eligible Rank Benefits** and confirm.

Only benefits for ranks the Character has already reached are eligible. Class Specific benefits require an eligible class on that Character. Each granted Item carries an internal provenance reference so that repeating the action does not issue the same benefit twice. **Grants are explicit GM actions.** The module does **not** automatically grant on rank change, revoke an Item when Renown decreases, or delete benefits the Character has already used.

## Managing Quest definitions

### Duplicate Quest

Choose **Duplicate** on a Quest card. The copy starts **Unavailable**, with refreshed definition identifiers and no assignees, individual progress, payouts, failure records, or payment operations. The original Quest remains unchanged.

### Quest & Faction Library

Open **Quest Manager → Library → Export JSON** to save a reusable collection of all HQR Faction and Quest definitions, rank benefit blocks, and referenced Item source snapshots. The export intentionally **excludes Actor Renown ledgers, individual outcomes, assignments, payouts, and compensation history**.

In another World, select **Import JSON**. Imported Factions and Quests receive new native Journal identifiers; Faction references are updated to the imported records, and missing source Items are recreated as World Items. Reimporting the same library skips records previously imported from that source rather than duplicating them. Existing Journal content is not overwritten.

Folder names/colors and Class Source/Enabled Class preferences are **optional** imports; select the checkbox only when the destination World has the required class sources installed. Always back up the destination World first. This feature is a **definition library**, not a complete World backup or a native D&D5e Faction importer.

### Delete Quest

A GM may confirm deletion when the Quest has no finalized outcome, payouts, reversal history, or pending transaction. A Quest assigned to Characters but not yet resolved may be deleted; this removes their access to that Journal and their unfinished Quest progress. Quests with recorded results or payouts are protected, including when deleting the Journal through Foundry's native controls.

## Reputation and Renown

Renown is stored in HQR's Actor ledger per Actor and Faction. A Character's value is distinct from a Group Actor's. The **Reputation** tab on supported D&D5e Character/Group sheets shows known Factions and ranks; **Renown** in the Journal Directory opens the GM's Reputation Manager.

The GM can make positive, negative, or zero-point adjustments to one or many Actors, with a reason, and inspect the recorded transaction history. Players can view permitted information but cannot use the GM management tools. A zero-point adjustment can establish that an Actor knows a Faction without changing its balance.

## World organization and safety

The module manages two Journal roots, **Hammer's Factions** and **Hammer's Quests**. Quest Journals are filed in the latter's **GM Only**, **Active**, and **Finished** subfolders according to global availability. A single Quest may have successful, failed, and unfinished Characters simultaneously; folders never represent a Character's individual outcome.

Back up the World before updating or importing a library. Avoid triggering the same reward or correction from two GM browser sessions concurrently: Foundry does not offer an atomic cross-Actor transaction for this workflow. Never delete Actor ledger flags or payout metadata manually to resolve interrupted operations.

## Troubleshooting

| Issue | What to check |
| --- | --- |
| Character missing from Quest Giving | Character Actor must have explicit Owner permission granted to a non-GM User. |
| Turn-In unavailable | Quest must be Available for success; reopen a Finished Quest when necessary. |
| Group not credited | Explicitly select the represented Group and enable that Renown row for Groups. |
| Rank benefit not granted | Verify Renown threshold, Actor class, enabled Class Sources, and accessible Item source; then grant from the Reputation Manager. |
| Failure penalty refuses an Item | Character needs one unambiguous Item stack matching the source name/type with sufficient quantity. |
| Undo Success refuses a correction | Restore missing coins or original, unequipped reward Items in their awarded quantities. |
| A transaction was interrupted | Resume the frozen operation; do not issue the same award again as a new operation. |
| Reputation tab absent from a custom sheet | Open the Renown Manager from the Journal Directory; third-party sheets may not support the native tab. |

Report issues at [GitHub Issues](https://github.com/hammer-PvP/Hammer-s-Quest-Renown/issues). Include the module, Foundry, and D&D5e versions, but avoid posting private campaign information.

## License

MIT. Copyright Raphael Andrade. Foundry VTT and the D&D5e game system are separate products and are not bundled with this module.
