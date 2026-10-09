# Hammer's Quest & Renown

Foundry VTT V14 module for the D&D5e 6.x game system. Uses native Journal Entries for Factions and Quests, maintains private GM-only journal pages and explicit Observer-only player access, and tracks per-Actor faction Renown.

- **Module ID / install folder:** `hammer-s-quest-renown`
- **Display name:** Hammer's Quest & Renown
- **Foundry:** minimum 14.367, verified 14.368
- **D&D5e:** verified 6.0.6, declared compatible range 6.0.0–6.0.999
- **GitHub:** https://github.com/hammer-PvP/Hammer-s-Quest-Renown
- **Manifest:** https://github.com/hammer-PvP/Hammer-s-Quest-Renown/releases/latest/download/module.json

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
