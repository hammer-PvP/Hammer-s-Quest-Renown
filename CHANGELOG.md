# Hammer's Quest & Renown — Developer Changelog

Technical development history. This file records version-specific changes,
migrations, fixes and compatibility notes. For installation, configuration and
normal use, consult [README.md](README.md) instead.

## v0.1.9 — Independent Quests, Journal Directory Controls & Class Source Filter

- **Factionless Quests (explicitly authorized):** the Quest Editor's optional `Owner Faction` selector defaults to `No Faction — Independent Quest`. Quests can be created before any Faction exists. New independent Quests persist `flags.hammer-s-quest-renown.factionUuid = null` and keep the existing native Journal/folder/assignment/reward/status lifecycle. Legacy empty owner values are read as ownerless without a bulk migration; existing owned Quests and any real `General` Faction are left intact.
- **Rewards remain separately targeted:** independent Quests may pay currency or Items with no Factions configured, or Success Renown / negative Failure Renown to *actual* target Factions when present. No synthetic Faction and no owner-based ledger destination. Public Briefings, native Journal status, GM-only Notes, Giving/Turn-In/Failure/Undo and Quest Manager use the existing engines.
- **Safety:** distinguish deliberate `No Faction` from nonempty unresolved `Missing Faction` references. Never silently convert a deleted-owner reference to ownerless. Lock owner changes after any recorded or pending Success/Failure Turn-In or Undo Failure, preserving receipts. An actual owner can be reassigned/cleared before that lock. No existing Journal, page, Actor, Folder or ledger is re-created or remapped.
- **Journal Directory:** GM toolbar is now `Factions → Quest Manager → [compact Renown icon]`. Removed only the redundant `New Quest` directory button; `Quest Manager → Create Quest`, native Quest Editor and public `api.newQuest` remain functional. Compact Renown retains accessible name/tooltip/keyboard navigation. Guard against duplicate injection remains.
- **Class Source filter:** only classes with ≥1 authorized source definition show in `Enabled Classes`, count toward enabled/available totals or appear in Class Specific rank slots. Source filters and Select Visible / Clear Visible apply locally without rerender; hidden previously checked classes remain checked/persisted and return when the source is reauthorized. Multiple permitted class UUIDs still form one logical class slot. Missing/historical definitions are neither silently replaced nor eligible for future grants.
- **Compatibility:** `dataVersion` stays **9**; existing settings/catalog schemas and all Folder Management markup and behavior are unchanged. No World-wide migration or new gameplay engine; Rank Benefit grants remain disabled.
- **QA:** syntax checks and local Node mocked smoke tests cover independent Quest save, Factionless currency-free Turn-In, Renown targeting, locks, status/folder assignment, Class Sources and selection preservation. **Live Foundry V14 + D&D5e 6.0.6 validation remains required.** Install on an offline-backed-up World before publishing.

---

## v0.1.8 — Independent Class Sources and Multi-Definition Class Eligibility

- **Two independent controls:** World Module Settings now has two separately collapsible panels: `Class Sources` (authorize any number of class compendiums / World Items) and `Enabled Classes` (enable logical classes such as Fighter and Wizard). Each logical class has one rank slot, regardless of the number of authorized definitions. The approved Folder Management markup and service remain unchanged.
- **OR-set definitions:** all class Item UUIDs from all permitted sources are retained for each enabled class, instead of forcing the GM to choose one version of a class. A Fighter from PHB 2024 and a Fighter from an authorized supplement both qualify as valid Fighter definitions when future granting is implemented. Grants remain **disabled** in v0.1.8; this patch configures and stores the eligibility model only.
- **Provenance and aliases:** every definition retains source pack/World Item, UUID, identifier and editorial source metadata. Equivalently named classes can share a logical slot even when a supplement uses a different internal identifier. Previously selected class keys and snapshots are migrated additively without rewriting existing Faction rank/benefit documents.
- **Migration:** `dataVersion 8 → 9`; World setting `rankClassCatalog` v2 → v3 (bindings hold a `definitions` array), `rankClassSources` v1 → v2 when saved. Existing Quest Journals, native folder IDs/colors/names, Character/Group reputation ledgers, payouts and histories are not changed. Multiple saves and schema upgrades are idempotent. An unavailable source is never replaced silently; missing-class definitions are treated as ineligible until restored.
- **UX:** compact Class Catalog stays collapsed by default; no exclusive per-class UUID dropdown. The count of authorized definitions and an inspection tooltip replace inconsistent repeated book labels. Source changes do not toggle class selections or reset window scroll/focus. README remains an end-user guide; this file records technical changes.
- **QA:** mocked dual-source Fighter (including different `system.identifier` values), third-source, disabling/re-enabling a source, idempotent migration and unchanged Faction data; syntax/template and package checks. Validate the interface in Foundry V14 / D&D5e 6.0.6 before public release.

---

## v0.1.7 — Explicit Class Sources and Exact Definition Binding

- **GM Class Sources:** a compact source selector in Module Settings now controls which D&D5e class compendiums / World class Items may contribute to the Class Catalog. It is independent of Feat, Item and Spell compendium availability and respects packs disabled in the D&D5e Compendium Browser.
- **Exact definition provenance:** class discovery retains every separate class Item UUID, source pack, bibliographic label and rules edition; a logical class name no longer silently inherits one merged 2014/2024 definition. A class found in multiple approved sources requires a specific choice before saving. When the approved sources leave exactly one definition, it is selected unambiguously.
- **Backward compatibility:** existing `class:<identifier>` slot keys, GM class selections and known UUIDs are preserved. The additive `dataVersion 7 → 8` migration upgrades `rankClassCatalog` to schema 2 by recording available legacy UUID/source snapshots, without rewriting Faction ranks, benefit blocks, Actor inventories, Renown ledgers, Quests or native folders. The separate `rankClassSources` World setting remains uninitialized until the GM explicitly saves class sources; its default view prioritizes the prior known source where identifiable.
- **UI and safety:** current collapsed catalog, dense two-column class list, source search/checkboxes and the approved Folder Management controls remain. Changing source filters or a definition updates only the live DOM, without application rerender. Class grant operations stay disabled. Unresolved definitions remain visible with a warning and cannot be silently bound to a different book.
- **QA:** synthetic mixed PHB 2024/SRD 2014, duplicate-source collision, disabled-pack, homebrew, migration, persistence and package integrity tests. Live Foundry V14 / D&D5e 6.0.6 verification required.

---

## v0.1.6 — Class Catalog Compact UI and Bibliographic Sources

- **Compact, collapsible Class Catalog:** global Module Settings now opens with the catalog folded into one summary line showing enabled/available class counts. Click or keyboard-toggle the accessible disclosure to edit. Expanded classes use dense two-column rows; no automatic full-window rerenders, and the existing selections remain in the DOM when collapsed.
- **Correct bibliographic labels:** inspect indexed `Item.system.source` before `pack.metadata.flags.dnd5e.sourceBook` and fall back to the pack title only when no source exists. The generic collection label "Character Classes" is no longer incorrectly presented as the source when real book metadata is present. PHB 2024 is shown only when confirmed by document/pack metadata. Multiple valid sources for one class remain visible, with books preferred before SRD.
- **Safety:** no changes to `rankClassCatalog` storage, folder settings, quests, factions, ledgers, Journals, payouts or grant logic; `dataVersion` remains 7. The approved Folder Management UI is untouched and Rank Benefits granting remains deferred.
- **QA:** syntax/package checks, mocked disabled-pack/source precedence/dedup/unchanged saved-selection checks, template disclosure/DOM preservation and unchanged managed-folder template checks. Live Foundry V14 / D&D5e 6.0.6 visual validation still required.

---

## v0.1.5 — Local Test: Class Catalog Layout and Custom Folder Names

- **Class Catalog layout fix:** resolve Foundry's generic `.hqr-app label { flex-direction:column }` cascade. Compact entries now explicitly position the checkbox on the left and the class name / real source compendium label on two aligned lines. The two-column list preserves source search, visible selection, and saved class identities. No Item grants are enabled.
- **World Folder Management:** extend the GM-only World Settings page with editable names alongside existing native Folder colors for all five logical roles: Factions, Quests, GM Only, Active, Finished. Add Reset Default Names independently from Reset Default Colors.
- **Stable native Folder identity:** new additive World settings `managedFolderNames` and `managedFolderIds`; persisted native Folder role flag `flags.hammer-s-quest-renown.managedFolderRole`. Resolution now prioritizes real Folder IDs / flags instead of display names and safely adopts existing v0.1.4 folders. Renaming or recoloring updates the SAME Folder documents; Journal UUIDs, folder memberships, ownership and Actor ledgers are not modified.
- **Validation/recovery:** reject empty, overly long, duplicate sibling names and collisions with unrelated folders before saving. Store desired names/colors before applying native changes, so a partial Foundry interruption can be resumed idempotently at GM startup.
- **Migration:** hidden `dataVersion` moves **6 → 7** after safe Folder identity setup and existing additive Faction rank migration. Legacy Quests/Factions and Character outcomes remain untouched. All previously selected classes and configured colors remain preserved.
- **Scope:** Quest Manager v0.1.3 UX and v0.1.4 administrative folders are unchanged; Rank Benefits drag-and-drop/granting stays frozen. README remains a user guide; CHANGELOG contains development history.
- **QA:** synthetic World folder-ID retention, rename/restart, duplicate/collision checks, unchanged Journal progress, syntax/package checks, and isolated browser layout verification. Requires Foundry V14 / D&D5e 6.0.6 live QA before public GitHub publication.

---

## v0.1.4 — Local Test: Global Settings and GM Only Folder Migration

- **Dedicated GM-only module settings:** registered a World Configuration submenu under Game Settings → Module Settings. It contains the global Class Catalog and a palette of five configurable native folder colors. Removed the Class Catalog button from the Faction Editor without modifying any rank or benefit records.
- **Existing Class Catalog preserved:** continue using the v0.1.2 `rankClassCatalog` world setting, including previously saved class identities, known names and source UUID snapshots. GM selection is not reset or silently replaced. The settings screen displays a compact multi-column list; search and selection update without full rerender.
- **Folder palette:** new independent `managedFolderColors` world setting (defaults Factions `#890b1e`, Quests `#ab960d`, GM Only/Active/Finished `#776809`). Applies native `Folder.color` only to the five managed folders; includes reset-to-default preview before Save. Idempotent and does not touch unrelated Journal documents or nested custom folders.
- **New native GM Only folder:** map global `unavailable` → `Hammer's Quests / GM Only`, `available` → `/ Active`, `inactive` → `/ Finished`. All relevant code paths (creation, save, availability change, startup synchronization) use the same mapping. No new Character statuses introduced; Quest Manager categories remain as in v0.1.3.
- **Versioned World migration:** hidden `dataVersion` advances **5 → 6** after folder sync and existing Faction rank migration complete. Moves only module-tagged Quest Journals, preserving their IDs/UUIDs, pages, progress, payouts, Renown and ownership. Existing assigned recipients of legacy Unavailable Quests retain their Observer access; GM Only is not a blanket permission-revocation mechanism. Module-managed folder IDs are reused when present; repeated migrations do not duplicate or modify documents.
- **Scope boundary:** Rank Benefits drag-and-drop and granting remain frozen; Quest Manager cards/filters are left unchanged. The Class Catalog choices and folders are configured globally, not per Faction.
- **QA:** isolated v5→v6 migration, repeat-sync idempotence, preserved assigned outcomes, unrelated document safety, palette updates, existing Class Catalog selection, JavaScript syntax and package checks. Validate in Foundry V14 / D&D5e 6.0.6 before public release.

---

## v0.1.3 — Local Test: Quest Manager Filtering and Compact Cards

- **Five live filters:** All, GM Only (global `unavailable`), Available (global `available` with no pending Characters), Accepted (global `available` with one or more pending Characters), Finished (global `inactive`). Individual Completed/Failed results do not move a Quest between administrative folders.
- **Search and counts:** Client-side search matches Quest and Faction names, ignores accents/case, combines with the chosen filter and updates counts per category. Filtering does not call `ApplicationV2.render()` or modify any Document.
- **Dense layout:** Approximately 20% less vertical space per Quest card, with a clearer border and compact action buttons. All existing actions and permission checks remain unchanged. A non-destructive warning highlights Unavailable Quests that still have unfinished assigned Characters.
- **Render reliability:** Explicit Refresh and external Journal updates preserve the manager's scroll position, active filter and search-focus context. Reuse a single updateJournalEntry hook per manager; remove the hook when it closes.
- **No folder/schema migration:** Native Journal structure stays `Hammer's Quests / Active` and `/ Finished`. `GM Only` and `Accepted` are views, *not physical folders* yet. Module `dataVersion` remains **5**, and Faction/Rank Benefits data from v0.1.2, Quest flags, historical results, payout and Renown ledgers are untouched. A future patch will migrate global Unavailable Quests into a GM-only folder with an access audit.
- **QA:** Static syntax/package checks and mocked classification, counts, filtering, data-preservation and rerender-context tests. Confirm in Foundry V14/D&D5e 6.0.6 before treating this as stable. Local test build; do not publish on GitHub until approved.

---

## v0.1.2 — Local Test: Class Catalog and Class Specific Slots

- **GM Class Catalog:** Discover class Items from the D&D5e 6.0.6
  Compendium Browser's enabled Item packs and World Items. The GM can
  enable/disable individual classes independently of other book contents.
  Alternate class versions sharing a native identifier collapse into one
  slot; homebrew classes with distinct identifiers are supported.
- **Safe first-use defaults:** Select native `dnd5e.classes` entries on first
  use; supplementary and homebrew classes require explicit GM opt-in.
  Class selection is stored in a separate world setting with source/name
  snapshots. Previously selected classes remain visible if a source
  subsequently becomes unavailable.
- **Class Specific rank slots:** Every selected class has a named, optional,
  empty placeholder row inside each Class Specific benefit block. General
  and Class Specific blocks can still coexist in one rank. Class Catalog
  changes refresh the slot rows without rerendering the Faction sheet or
  clearing unsaved edits and focus.
- **No schema rewrite:** Module `dataVersion` remains 5. Existing rank IDs,
  blocks, Journal data, Quest histories, personal/Group Renown, Actor Items
  and prior grants remain untouched. The Class Catalog uses a new additive
  world setting; no grant engine is enabled in this release.
- **Deferred:** Drag-and-drop of Items/Feats/Features/Spells and their source
  UUIDs, as well as granting to Actors, will follow in later v0.1.x work.
- **Development QA:** automated mocked source filtering, class discovery,
  Core-only defaults, saved selections, duplicate merging and browser DOM
  regression for scroll/draft-preserving slot updates. Live Foundry V14/D&D5e
  6.0.6 testing remains required before considering this patch stable.

---

## v0.1.1 — Local Test Hotfix: Faction Save and Editor Drafts

- **Critical Faction save fix:** Import `normalizeFactionRanks` into the Faction document service. The missing import caused `ReferenceError` on *every* Save Faction attempt, even without benefit changes.
- **No full rerender for microactions:** Adding/removing a General or Class Specific block and adding/removing a rank now update only the relevant DOM nodes. This preserves the current scroll position, focused controls, image field, description and GM Notes drafts. Newly added blocks are revealed inside the editor's own scroll pane.
- **Reliable save interaction:** Prevent concurrent Save Faction clicks; preserve the current scroll position on successful save/reopen of the editor and keep the user's form untouched when a save fails.
- **Persistence:** General and Class Specific blocks (including empty blocks) retain stable IDs, rank associations and previously saved metadata. Existing rank names/thresholds and unrelated Quest/Actor records are not changed by the hotfix.
- **Schema:** No new migration is required. The module data schema remains `dataVersion 5`, as introduced in v0.1.0.
- **Local validation:** JS syntax, isolated save/repeat-save and empty-block persistence, and headless-browser DOM tests for add/remove without draft or scroll reset passed. Foundry V14/D&D5e 6.0.6 live QA is still required. This is an unreleased test build, not a published stable GitHub Release.

---

## v0.1.0 — Rank Benefits Foundation and Journal UI Reliability

- **Foundation only:** Faction rank records now carry stable `id` and a `benefits` array.
  Blocks have their own stable `id`, `type` (`general` or `classSpecific`),
  `items` and `classes` fields, reserved for future source linking and grants.
- **Faction Editor:** Add and remove multiple General/Class Specific blocks inside
  each rank. Empty slots remain valid; the editor labels this as a foundation
  stage and does not grant any document to Actors.
- **Backward-compatible data migration:** Hidden `dataVersion` advances from 4
  to 5 on GM startup only after Quest folder synchronization and additive
  Faction-rank updates succeed. Existing rank names, thresholds, Quest Journal
  UUIDs, individual progress, payouts, Group records and Actor ledgers stay intact.
  Retry reuses persisted rank/block IDs.
- **Journal UI:** Prevent legacy duplicate DOM-injected header Edit buttons on
  V14 ApplicationV2, avoid duplicate native header controls, and strip orphan
  outcome stamps from header/incorrect mounts. Only valid seals inside the
  public Quest Briefing's status panel are shown.
- **Documentation:** README replaced with a current user guide; previous release
  technical notes moved into this CHANGELOG.
- **Verification:** JavaScript syntax and isolated migration/idempotency tests
  passed. Live Foundry V14/D&D5e 6.0.6 regression testing is required before
  considering the visual fix fully confirmed.

---

# Hammer's Quest & Renown

Foundry VTT V14 module for the D&D5e 6.x game system. Uses native Journal Entries for Factions and Quests, maintains private GM-only journal pages and explicit Observer-only player access, and tracks per-Actor faction Renown.

- **Module ID / install folder:** `hammer-s-quest-renown`
- **Display name:** Hammer's Quest & Renown
- **Foundry:** minimum 14.367, verified 14.368
- **D&D5e:** verified 6.0.6, declared compatible range 6.0.0–6.0.999
- **GitHub:** https://github.com/hammer-PvP/Hammer-s-Quest-Renown
- **Manifest:** https://github.com/hammer-PvP/Hammer-s-Quest-Renown/releases/latest/download/module.json

## v0.0.9 — Active / Finished Journal Directories (Production-safe Migration)

**Upgrades existing v0.0.8 campaign data without rebuilding Journals.** Make a full offline World backup before enabling. Migration runs on GM startup and advances hidden `dataVersion` from **3 to 4** only after completion; repeated starts are safe.

- **New folder layout:** `Hammer's Factions` contains Faction Journals; `Hammer's Quests / Active` contains Available and Unavailable Quests; `Hammer's Quests / Finished` contains administratively Inactive Quests **regardless of each Character's Completed/Failed result**. Quest owner Faction remains a Journal UUID reference, no longer a folder.
- **GM closes a Quest explicitly:** `Finish Quest` changes global availability to the existing internal `inactive` status, moving the same Journal into `Finished`. `Reopen (Available)` returns it to `Active`. Finishing a Quest **never automatically marks pending Characters Failed** or applies Failure Penalties. The separate Fail Turn-In and Undo Failure from v0.0.8 remain intact.
- **Folder root rename:** when possible, existing `Quests - Hammer's Quest & Renown` and `Factions - Hammer's Quest & Renown` folders are renamed in-place, preserving native Folder IDs and Journal IDs. If a new root already exists, module Journals are relocated into it. Empty recognized old faction/`Inativas` subfolders are cleaned up bottom-up; any folder containing other documents or custom child folders is preserved.
- **Scope:** only JournalEntries with `flags.hammer-s-quest-renown.kind` = `quest` or `faction` are moved. Migration does not rewrite descriptions, pages, objectives, individual progress, payout records, Actor ledgers, Renown, or permissions. Reopening a Quest does not undo individual Completed/Failed states.
- **Native colors:** Quests root `#ab960d`, `Active`/`Finished` `#776809`, Factions root `#890b1e`. No dependency on Character Builder.
- **Validation required:** check one existing Active, Finished, Completed, Failed and Undo Failure case in your real World. A successful static simulation does not replace live Foundry V14 verification.

## v0.0.8 — Production hotfix: Undo Failure & Journal Seal Layout

**Upgrade from v0.0.7 without recreating Quests, Factions, Actors or Journal pages.** Back up the production World before enabling the update. This update is additive and does not rewrite existing `Completed` outcomes, currency/item receipts, historical Failure Turn-Ins, or Actor Renown ledgers.

- **Undo Failure (GM only):** Open Quest Manager → `Undo Failure`, or Quest Results → `Undo Failure`. Choose individual Failed Characters (or `Select All Failed`), provide a required correction reason and confirm. The selected Characters are restored to **Accepted** when v0.0.7 did not record their previous status, or to their recorded prior `Accepted`/`In Progress` status when available. Their existing assignments and Observer Journal access are preserved. If the Quest is globally Inactive, make it Available separately before accepting a Success Turn-In.
- **Recover accidental seven-Character failures:** The same correction can restore all seven Characters for a Quest such as *A Lâmina dos Ecos Perdidos*, leaving other Quests and previous Completed Characters untouched.
- **Safe Penalty Compensation:** Original negative Renown entries are retained for audit; verified penalties incurred from the exact Failure Turn-In receive uniquely keyed positive compensating entries. Group penalties are not reversed automatically—select the affected Group explicitly if permitted. No penalty is invented when the Quest had none.
- **Interrupted correction recovery:** A frozen `activeFailureReversal` is stored before any Actor is modified. If interrupted, re-open Undo Failure and choose **Resume Undo Failure**; recorded compensation keys are reused so a reward cannot be returned twice. A pending Undo blocks concurrent Success/Failure Turn-In processing on that Quest.
- **Journal stamp visual fix:** Only one personalized status panel is inserted, anchored inside the public Quest Briefing document, instead of allowing fallback insertion into the Journal window chrome. The old stray Completed/Failed icon near the top-right window controls must not be recreated. CSS anchors seal elements inside the authorized panel.
- **Preserved history:** `failurePayouts` remains unchanged. Reversal details are appended to `failureReversals`, while a selected Character's progress changes from Failed back to an unfinished state. The original failure remains visible in the historical audit trail.

**Validation:** isolated smoke tests cover seven-Character Undo, ledger compensation, optional Group compensation safeguards, F5/restart-style interruption recovery, double-Undo prevention, and issuing a *new* Failure Turn-In after a completed reversal. The Journal mount was code-reviewed; actual in-Foundry UI verification is still required.

## v0.0.7 — Production-safe Failure Turn-In & Inactive Journals

**Upgrade from production v0.0.6 without recreating Quests, Factions, Actors, Journals or previous Success payouts.** Make a full backup of your production World with Foundry stopped before upgrading. The hidden world schema setting `dataVersion` migrates idempotently from **1 to 2**.

- **Failure Turn-In:** a separate GM command in Quest Manager marks individually selected Characters Failed. Available or Inactive Quests may receive a Failure Turn-In. Completed Characters remain Completed, and no standard Success Currency, Items or Renown is granted by a Failure Turn-In.
- **Failure Penalties (optional, GM-only):** the Quest Editor adds an initially **disabled** list of negative Faction Renown amounts. Each Faction may occur only once; multiple Factions are allowed. The GM can enable/disable recipients for each penalty row during the Failure Turn-In. Group Actors are candidates derived from selected Characters and are always **optional**; nothing is granted or removed from a Group without explicit selection. The values are not revealed in the public Quest Journal.
- **No penalty by default:** older Quests have no enabled penalties. A Failure Turn-In only records the `Failed` outcome when no penalty is configured.
- **Idempotent receipts and interrupted operations:** failure distribution uses a separate frozen `activeFailureTurnIn` plan and per-Actor ledger keys, `failurePayouts` and `groupFailures`. It resumes without reapplying completed rows. Existing `payouts`, `groupAwards`, Currency/Item receipts, manual `ledger`, `activeTurnIn` and `pendingRenownBatch` remain untouched.
- **Inactive != Failed:** changing the global Quest availability to `Inactive` now **only archives** it; it no longer automatically fails unfinished Characters. Their individual states persist until a GM explicitly performs a Failure Turn-In. Success Turn-In requires Available; Failure Turn-In supports Available or Inactive.
- **Legacy auto-fail handling:** Characters automatically marked Failed by older releases (`reason: "Quest became Inactive"`) retain their existing Failed state. The GM can explicitly confirm their Failure Turn-In, with any newly configured penalties, once; their original failure timestamp is preserved as `legacyAutoFailedAt`. Other previously recorded Failed/Completed states are never implicitly reset.
- **Native folder colors:** `Quests` root `#ab960d`, Faction subfolders `#776809`, `Factions` root `#890b1e`, and newly created `Inativas` folders use the darker shade `#5a500b`. All managed Inactive Quests move to `Quests / <Faction> / Inativas` with **the same Journal UUID**. Re-activating moves them back. The migration limits automated moves to the module's recognized folders and skips custom/manual folder locations.
- **Original monochrome SVG seals:** Completed = intact check seal tinted green, Failed = cracked X seal tinted red. The module provides two original, simple vector SVG paths and CSS mask coloring; no AI-generated or external image assets. The native read-only Journal status panel shows the outcome for the User's selected Character.
- **Privacy:** Journal profiles remain Observer-only to eligible assigned Users; GM Notes pages remain private. No existing permissions or private Journal content are relaxed.

### Production validation notes

- Before enabling this release in the campaign, create a **complete offline World backup**. Multiple GM clients should not execute Turn-Ins simultaneously; Foundry document writes are not atomic transactions.
- Verify a previously Completed Quest still shows Completed and its prior rewards; check an Inactive Quest still keeps unfinished Characters without creating a new automatic failure.
- In an existing Inactive Quest with older automatic failures, use the **Fail Turn-In** to confirm selected legacy rows if the GM wishes to apply newly configured penalties. No pre-existing Renown loss is automatically added.
- The module cannot be considered fully validated on your Foundry V14 installation until live testing succeeds; static/isolated tests are not a substitute for a backup and World QA.

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
