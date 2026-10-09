# Hammer's Quest & Renown — v0.0.3

A Foundry VTT v14 (verified 14.368) / D&D5e 6.0.6 quest, faction and reputation module. **This is a GM-controlled journal workflow. Player journal permissions are Observer only, never Owner.**

## GitHub Release

Create a release with tag `v0.0.3` in `https://github.com/hammer-PvP/Hammer-s-Quest-Renown` and upload exactly two assets:

- `hammer-s-quest-renown.zip` — ZIP containing module files at archive root, installed by Foundry into `Data/modules/hammer-s-quest-renown/`.
- `module.json` — release manifest pointing to the versioned ZIP.

Install/update manifest: `https://github.com/hammer-PvP/Hammer-s-Quest-Renown/releases/latest/download/module.json`

## v0.0.3 UI + Bugfix Release

- Native Character and Group Reputation tabs now use a **single compact, non-wrapping row per faction**, with Rank and Current/Maximum for each relevant scope. Numerical columns, including each slash, have a fixed horizontal position. The maximum is the faction's highest configured Renown threshold; it does not cap stored Renown.
- Character sheet displays Personal and Group side by side; a Group sheet displays Group only. Where a Character belongs to multiple Group Actors, the designated Party is preferred; no Group balances are summed.
- `Manage` button is GM-only and opens the Reputation Manager preselected to the current Actor via a delegated click listener that survives partial sheet rerenders.
- Faction image input now has the native Foundry v14 FilePicker (`Browse`), `Clear`, instant 5:3 contain preview, and a consistent contain-framed image in the public Journal. Unsaved Faction edits are preserved when picking images.
- Distinctive book-and-quill SVG icon replaces medal-style Renown icons.
- No migration: existing Journals, UUIDs, flags, assignments, ledger/history and claimed rewards remain compatible with v0.0.2.

## Workflow (v0.0.3)

1. **Factions** in Journal Directory: create a Faction Journal with public lore, configurable Renown ranks and a private GM Notes page.
2. **New Quest** in Journal Directory: design name, Faction, public Flavor, Objectives, Currency, Items (drag & drop from World/Compendium; editable quantities) and Renown. Add private GM Notes. The new Quest is **Unavailable** and **requires no recipients**.
3. **Quest Manager** in Journal Directory: edit the Quest, mark it Available or Unavailable, then select **Quest Giving** on an Available Quest.
4. **Quest Giving**: assign to a Group Actor or choose individual Characters with explicit non-GM Player Owner; set initial progress Offered/Accepted/In Progress. This reveals the public Journal only to the permitted Users.
5. **Quest Turn-In**: change progress to Accepted/In Progress/Completed/Failed/Abandoned, or choose **Complete & Grant Rewards**. At Turn-In, select shared Group Renown or eligible individual participants, plus the Actor inventory for physical Items/Currency. Rewards are applied at most once per Quest; partially applied grants use an immutable payout plan and per-reward idempotency keys.
6. **Renown**: use Journal Directory's Reputation Manager to adjust any Character or Group with a mandatory reason, including negative and zero values (zero records discovery). A dedicated **Reputation** tab is added to the default native D&D5e 6.0.6 Character and Group Actor sheets, showing their stored scores; Character sheets also show visible Group scores without merging them.

## Native Journal folders

- `Factions - Hammer's Quest & Renown` — managed Faction journals with Public and GM Only pages.
- `Quests - Hammer's Quest & Renown` — one folder per Faction, containing Quest journals with Public and GM Only pages.

Fação discovery is triggered by the first recorded Renown event, even zero or negative. Quest viewing is controlled by assignment, not merely Available status. The same journal is shared; no duplicated player copies.

## Migration from v0.0.1

- Existing Quests, Factions, Journal UUIDs, Actor Renown history and reward-issued flags are preserved.
- Existing Quest status/assignments remain intact, but Quest Editor stops editing recipients and reward destinations; use Quest Manager and Turn-In instead.
- Existing Available quests remain Available and become visible only when subsequently assigned using Quest Giving.
- Existing completed quests whose rewards were granted remain locked against a second grant.

## Known limitations / QA

- The app's Quest/Faction public text and GM Notes editors remain plain multiline text fields. The output is formatted native Journal pages.
- This release supports a single assignment/progress state per Quest. Multi-party independent quest instances and prerequisite chains are not included.
- Currency and Items are given to one chosen Actor inventory; splitting money or choosing independent Item recipients is not yet supported.
- Native Reputation tabs are integrated into **default D&D5e 6.0.6** Character/Group sheets. Third-party replacement sheets may only show the header Reputation control.
- A player can only see Group Renown in their Character sheet when that Group Actor is itself Observer-accessible to them. The module deliberately does not broaden Group Actor permissions (which could expose its other data).
- Page-level GM-only security and live Quest permissions must be tested with a real player client; code validation is not a substitute for Foundry multi-client testing.
- Avoid simultaneous grants by multiple GMs. Partial multi-document awards are protected for normal retries but aren't a database transaction.
- Do not delete faction journals before their dependent quests; deletion/migration tooling is future scope.
