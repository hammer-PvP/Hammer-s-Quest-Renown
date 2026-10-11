# Hammer's Quest & Renown

Foundry VTT V14 module for the D&D5e 6.x game system. Uses native Journal Entries for Factions and Quests, maintains private GM-only journal pages and explicit Observer-only player access, and tracks per-Actor faction Renown.

- **Module ID / install folder:** `hammer-s-quest-renown`
- **Display name:** Hammer's Quest & Renown
- **Foundry:** minimum 14.367, verified 14.368
- **D&D5e:** verified 6.0.6, declared compatible range 6.0.0–6.0.999
- **GitHub:** https://github.com/hammer-PvP/Hammer-s-Quest-Renown
- **Manifest:** https://github.com/hammer-PvP/Hammer-s-Quest-Renown/releases/latest/download/module.json

## v0.0.6 — Production-safe Manual Renown Batches

**Compatible, additive update from v0.0.5.** This release does **not** convert, clear, rewrite or truncate any existing Actor `flags.hammer-s-quest-renown.ledger`, Journal, Quest/Faction UUID, Quest payout state or permission settings.

- **Manual Reputation batch:** select multiple eligible Characters (non-GM explicit Owner) via checkboxes, with Select All, Clear and name filtering. Group Actors are in a **separate collapsible selector**, with independent checkboxes. Selecting Characters **never** selects their Groups.
- **One signed adjustment + required reason per operation:** applied independently to every selected Actor. `0` remains supported to discover a Faction without changing its balance.
- **Live impact preview:** for each chosen recipient, show their old and projected Renown total before confirmation.
- **Durable resume:** before mutating any Actor, freeze the batch into a private world setting. Every recipient has a deterministic ledger key; a resumed batch skips Actors already recorded. When interruption occurs, new batches are blocked until the saved operation completes. Never manually clear a pending batch setting to retry.
- **Known Factions:** closed by default; count shown, expanding reveals a list with a fixed-height internal scroll. No Faction data is discarded.
- **History:** last 5 events by default; View Full History opens paginated 20-event pages with local scroll, preserving the complete ledger in the Actor.
- **Inspect recipient:** each recipient has a View action for their existing Factions/History without changing which Actors will receive the adjustment.
- **Versioned additive migration:** hidden world `dataVersion` moves to 1 on GM startup. `pendingRenownBatch` is a new world setting with an empty default. No existing documents need to be migrated; repeat startups are idempotent.

**Operational safeguards:** back up your production World before installing any update. Do not execute batch adjustments concurrently from multiple GM clients. Foundry multi-document writes are not transactional; this release offers interruption recovery but cannot guarantee atomicity across multiple simultaneous GM sessions.

## v0.0.5 — Each Rewards & Individual Quest Outcomes

**Prototype schema change:** No automatic migration of experimental v0.0.4 Quests. For predictable testing, create new Quests in a test World. Existing Faction Journals and Actor Renown ledgers are not intentionally deleted.

- Quest Giving always sets newly assigned Characters to **Accepted**. Add more eligible Characters later, even after others completed. `Select All` and `Clear Selection` affect only newly eligible Characters.
- Availability is global: **Unavailable / Available / Inactive**. Completed / Failed are stored separately for each assigned Character on the same Quest Journal.
- Quest Turn-In selects **unfinished assigned Characters**. Currency and Item rewards are **Each**: every newly completing Character receives the full values directly into their own inventory. Personal Renown rewards also apply once per Character.
- Represented Groups are filtered by current selected participants, initially unchecked and always optional. Each explicitly selected Group can receive its collective Renown **once per Quest**, no matter how many Characters complete later.
- Every Turn-In saves a recipient snapshot, individual status and receipt history. Interrupted payouts resume from their saved recipients. Currency and Item reward receipts and Renown ledger keys guard against duplicate payments.
- Marking a Quest **Inactive** automatically marks assigned Characters who have not completed it **Failed**. Completed results remain. Journal, UUID, history and all rewards persist. Reopening availability does not undo failures automatically.
- A single native Journal shows a **golden Completed** or **rusted Failed** seal based on the viewing Character. If a User controls multiple assigned Characters, the status panel has a Character selector. GM sees a summary.
- Fixed misaligned/duplicated checkbox styling across the module. Added bulk select/clear controls to Giving and Turn-In.
- GM-only pages remain private; player Journals are read-only Observer. Native D&D5e 6.0.6 Character and Group Reputation tabs remain Actor-specific.

**Known constraint:** This package has passed isolated service tests and static/syntax checks, but has not been run in a live Foundry V14 World. The personalized Journal status panel must be visually verified in the native Journal sheet.

## v0.0.4 — Multi-Faction Renown, Characters & Optional Groups

This release changes the prototype Quest reward schema and assignment model. There is **no migration of experimental Quests created with v0.0.3 or earlier**. Recreate those Quests for reliable v0.0.4 Turn-In testing. Already recorded Actor ledgers are not deleted.

### Quest Editor

- Each Quest remains a native Journal in `Quests - Hammer's Quest & Renown` → *Faction Name*, with a separate player-visible briefing page and GM-only notes page.
- A Quest can be created as **Unavailable**, without recipients. Quest availability and giving are managed afterward.
- Currency rewards and drag-and-drop Items work as before.
- **Renown Rewards** are now an editable list: `+ Add Renown Reward` adds a line with a Faction dropdown and signed integer amount. Use as many distinct Factions as necessary, including negative amounts. The Quest's owner Faction is independent of those affected.
- Adding/removing a Renown reward is a localized DOM operation, preserving the scroll position.

### Quest Giving

- Giving is **Character-based**: choose any eligible Character Actors with a non-GM User explicitly at Owner level.
- Assigning a Quest does not require a Group Actor. Player Users receive Observer access only, never Owner.
- Group associations do not automatically assign or reveal Quests to other characters.

### Quest Turn-In

- Check which assigned eligible **Characters actually participated**. Each selected Character can receive the complete personal delta from every configured Faction reward line.
- An optional **Represented Groups** list is derived from the selected participants' native D&D5e Group Actor memberships. Groups are **never preselected** and may all remain unchecked, even if participants belong to groups.
- Select zero, one, or multiple represented Group Actors. Each selected Group receives the full collective delta once per Faction reward line, irrespective of how many of its members participated.
- Every reward line has independent **Characters / Groups** target toggles, defaulting to both. No target is inferred or paid unless its Actor was checked. A line with no recipients requires explicitly disabling its targets.
- Changing group membership later never moves, duplicates, or merges ledger entries. The immutable payout plan records participating Characters, represented Groups, and per-line scopes.
- Retry protection uses an Actor-specific key for each `Quest + reward line + Actor` and a locked payout plan for partial grants. Currency and Item payout guards from previous releases remain in place.

### Reputation

- A Character sheet displays **only that Character Actor's personal Renown**; a Group sheet displays **only that Group Actor's collective Renown**. There is no auto-inheritance, sum, or shared display across sheets.
- Compact native D&D5e Character and Group `Reputation` tabs: one row per Faction, with **Faction | Rank | current / faction maximum**, fixed-width numeric columns, no progress bars, and no large cards.
- The **Manage** control opens the Actor's Reputation Manager, where GMs can issue manual positive, negative, or zero changes with mandatory reasons. Transaction histories are retained.
- Faction Journals are revealed once an eligible Actor's ledger contains a Faction record, including zero or negative Renown; public journals remain Observer-only and GM notes private.

### Quest Manager & Results

- A Quest marked `Completed · Rewards Issued` no longer offers an active **Quest Turn-In** action; it offers **View Results** instead.
- Results are **read-only** and show the immutable payout snapshot: participating Characters, represented Groups, Faction deltas, and Currency / Item inventory recipient.
- Failed and abandoned Quests do not offer automatic reward Turn-In. Completed Quests with pending rewards can still be paid once.
- The Quest Manager refreshes when its managed Quests are updated, including when rewards become issued.

### Faction Manager & visual identity

- The native Foundry FilePicker, 5:3 contain-fitted preview, public/GM private lore split, custom per-Faction ranks and separate faction Journal directory remain from v0.0.3.
- Book-and-quill SVG identity remains included within the module; no Character Builder runtime dependency.

## Native Journal folder structure

- `Factions - Hammer's Quest & Renown` — faction Journals with public profiles, ranks, and private GM Notes pages.
- `Quests - Hammer's Quest & Renown` — one child folder per Faction; Quests contain public narrative/objectives/rewards and private GM Notes.

## QA and limitations

- JavaScript syntax, JSON manifest structure, template block balancing, ZIP integrity and isolated payout service flows can be validated outside Foundry. **Full multi-client Foundry V14 / D&D5e 6.0.6 validation is still required.**
- Quest assignment and lifecycle are one state per Quest Journal, not separate Quest instances for multiple independent parties.
- Item and Currency rewards are still delivered to **one selected inventory Actor**; independent splitting/assignment of individual Items and coins is future scope.
- No automatic prerequisites, rank perks, or quest chains in this release.
- Public/GM fields are multiline text inputs and output as Journal pages, not a full rich text editor.
- Third-party replacement Actor Sheets may omit the custom native Reputation tab, but header/menu access to Reputation Manager remains where integration permits.
- Do not run concurrent Turn-In payouts for the same Quest on multiple GM clients. Payouts have retry and idempotency protection, but Foundry multi-document writes are not database transactions.
