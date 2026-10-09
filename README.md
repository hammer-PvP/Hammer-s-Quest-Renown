# Hammer's Quest & Renown — v0.0.1

Foundry VTT v14 + D&D5e 6.0.x module for organizing quests and factions directly in the native Journal directory. **GM controls all writes; players only receive Observer access** to documents intended for them.

## Installing from GitHub Releases

Create the GitHub release with tag `v0.0.1`. Upload the assets `hammer-s-quest-renown.zip` and `module.json` (both supplied separately). Paste this URL in the Foundry Module Installer:

`https://github.com/hammer-PvP/Hammer-s-Quest-Renown/releases/latest/download/module.json`

The release archive contains the module files at the ZIP root, as expected by the Foundry package installer. Foundry installs it into `Data/modules/hammer-s-quest-renown/`.

## Getting started

1. Enable the module as a GM, open the **Journal** directory, and click **Factions**.
2. Create a faction, its public lore, optional emblem URL, renown ranks, and private GM notes.
3. Click **Quest**, choose its faction, group or individual player characters, objectives, public rewards, and GM-only notes.
4. Change the Quest status to **Accepted** or **In Progress**, then Save. Eligible players gain Observer access to its Journal. An **Available** quest is not automatically shared.
5. Complete the quest, Save, then use **Grant Rewards** after selecting an Item/Currency destination. This is a distinct GM action, recorded against the quest to prevent normal repeat claiming.
6. Click **Renown** in the Journal directory or **Reputation** in a D&D5e Character/Group sheet header to view reputation and record manual changes (with a required reason).

## Journal structure

- `Factions - Hammer's Quest & Renown` — one native Journal per faction, public profile + GM-only Journal page.
- `Quests - Hammer's Quest & Renown` — one folder per faction containing native Quest Journals, public briefing + GM-only Journal page.
- Factions are revealed to users when eligible player characters or their assigned group first receive any recorded renown entry (including zero).
- Individual participants must have a non-GM user with **explicit Owner** on the Character Actor. Merely being a `character` type or having GM access is insufficient.
- Faction and quest permission grants are **Observer only** for users, never Owner. Private pages have explicit NONE permissions.

## Rewards

- Currency denominations: PP, GP, EP, SP, CP. These are transferred to the explicitly selected Actor, not silently divided.
- Item rewards: world / compendium Item UUID, quantity, native `@UUID` links and Item drop zone. The Item will be copied into the selected Actor inventory on **Grant Rewards**.
- Renown: assigned to the Group Actor or eligible participants. History records each grant and prevents rerunning identical renown award IDs.
- Manual renown changes accept positive, negative, or zero integer amounts; zero is useful to discover a faction.
- Quest public information is generated from structured fields; GM notes are stored in a separate restricted Journal page.

## v0.0.1 known limits and test priorities

- Editors use multiline plain-text inputs for flavor and GM-only notes, then generate formatted native Journal pages. Rich-text editing within the custom editor is not yet provided.
- Reputation is opened by a sheet **header action**, not yet embedded as a native D&D5e Character/Group sheet tab.
- Permission enforcement is GM-side. Test JournalEntryPage page-level visibility with an actual player client on Foundry 14.368 before using sensitive campaign secrets.
- Custom rewards are delivered to **one chosen Actor inventory**; no currency splitting or claimed-item choice UI in this version.
- Avoid concurrently claiming the same quest from two GM clients. Partial reward application is designed for retry, but a restart during a non-atomic multi-document operation should be reviewed before retrying.
- Do not delete a faction journal before managing its quests; deletion / migration workflows are future scope.
- When editing GM notes directly in the native Journal text editor, opening and saving the custom editor normalizes them to plain text; keep initial editing inside the custom editor to avoid losing rich formatting.
- Interactive Foundry runtime and multi-client permission tests are required; package validation alone does not certify Foundry compatibility.
