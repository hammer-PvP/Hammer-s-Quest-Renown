# Hammer's Quest & Renown

**A journal-based Quest, Faction, and Renown manager for Foundry Virtual Tabletop and the D&D 5e game system.**

Create quest briefings and faction profiles, assign adventures to individual characters, award currency and items, record successes or failures, and track how each character or adventuring group is regarded by different factions—all without replacing Foundry's native Journals or D&D5e character sheets.

**Interface language:** English · **License:** MIT

[Install the module](#installation) · [Get started](#quick-start) · [Quest workflow](#managing-quests) · [Renown guide](#reputation-and-renown) · [Troubleshooting](#troubleshooting)

## At a glance

| Feature | What it does |
| --- | --- |
| Native Quest Journals | Public briefing, objectives, announced rewards, and a separate private GM Notes page |
| Factions | Public profiles, optional emblems, customizable Renown ranks, and private lore |
| Individual quest progress | One Quest Journal can have different `Accepted`, `Completed`, and `Failed` outcomes for different characters |
| Quest Giving | Assign an available Quest to eligible player-owned Characters, including additional Characters later |
| Success Turn-In | Give each selected Character the full configured currency, items, and personal Renown rewards |
| Failure Turn-In | Mark selected Characters as Failed and apply optional, configurable negative Renown penalties |
| Undo Failure | Correct an accidental failure, restore Characters to an unfinished state, and compensate applied Renown penalties |
| Group Renown | Optionally award or deduct collective Renown for explicitly selected D&D5e Group Actors |
| Reputation Manager | Inspect balances, ranks, and history; make manual adjustments for one or many Actors |
| Native D&D5e sheet integration | Compact Reputation tab on supported Character and Group sheets |
| GM Only / Active / Finished filing | Automatically file prepared, available, and closed Quests by GM administrative status without changing individual results |
| Quest Manager filters | Browse All, GM Only, Available, Accepted and Finished; live search by Quest name or Faction with category counts |
| World Module Settings | Configure Class Sources separately from logical Enabled Classes; customize native managed folder names and colors |

## Compatibility

| Requirement | Supported version |
| --- | --- |
| Foundry Virtual Tabletop | V14; minimum `14.367`, verified `14.368` |
| D&D 5e system (`dnd5e`) | `6.0.x`; verified `6.0.6` |
| Character Builder or other modules | **Not required** |

The Reputation tab is designed for the native D&D5e Character and Group sheets. Third-party replacement sheets may not display the tab, even where the Reputation Manager remains accessible.

## Installation

1. Open **Foundry Setup → Add-on Modules → Install Module**.
2. Paste this manifest URL into **Manifest URL**:

   ```text
   https://github.com/hammer-PvP/Hammer-s-Quest-Renown/releases/latest/download/module.json
   ```

3. Install the module, then enable **Hammer's Quest & Renown** in your D&D5e World under **Manage Modules**.
4. Log in as GM. The module migrates and maintains its managed Journal folders automatically.
5. Open the **Journal Directory** to access Quest/Faction tools. Open **Game Settings → Configure Settings → Module Settings → Hammer's Quest & Renown → Open Settings** for the global Class Catalog and folder names/colors.

You can also obtain release files from [GitHub Releases](https://github.com/hammer-PvP/Hammer-s-Quest-Renown/releases).

> **Updating an existing World?** Back up the complete World with Foundry stopped before updating. The module preserves existing managed Journal IDs, Actor Renown ledgers, quest outcomes, and payout history through its versioned migrations. A backup is still strongly recommended for a live campaign.

### Testing an unpublished local build

Until a test build is published on GitHub, its release manifest does **not** provide a working update URL. To test a ZIP locally, shut down Foundry, back up the World, and extract the module files into `Data/modules/hammer-s-quest-renown/` within the Foundry User Data directory (the `module.json` file should be directly inside that folder). Restart Foundry and open the World to test. Avoid running an automated update from the public manifest until that version has been published.

## Quick start

For a complete first Quest, follow this order:

1. **Create a Faction.** In the Journal Directory, select **Factions**. Name it, describe it, and optionally configure an emblem, rank thresholds, and GM-only notes. Save.
2. **Create a Quest.** Select **New Quest**, enter a title, choose the Faction, add its public briefing and objectives, then configure any rewards. Save. New Quests start as **Unavailable**.
3. **Make the Quest Available.** Open **Quest Manager**, find the Quest, and select **Make Available**.
4. **Give it to your players.** Select **Quest Giving**, choose eligible Characters, and confirm. Each new recipient starts with **Accepted** status.
5. **Resolve each Character's outcome.** Use **Quest Turn-In** for success or **Fail Turn-In** for failure. The two actions are independent; one Character may complete the Quest while another fails or is still working on it.
6. **Finish the Quest when appropriate.** Select **Finish Quest** to move its Journal to **Finished**. This does **not** automatically mark unfinished Characters as Failed.

## Where to find the controls

When logged in as GM, the **Journal Directory** adds four buttons:

| Button | Purpose |
| --- | --- |
| **New Quest** | Open the Quest Editor |
| **Quest Manager** | Manage Quest availability, assignment, outcomes, results, and corrections |
| **Factions** | Create and edit Factions |
| **Renown** | Open the Reputation Manager |

Managed Quest and Faction Journals also have an **Edit Quest / Faction** control for GMs. A supported D&D5e Character or Group sheet provides Reputation access through its custom tab or a header control where available.

## Journal folder organization

The module uses two managed root folders:

```text
Journal Directory
├── Hammer's Factions
│   ├── The Eastern Council
│   └── Guardians of the Vale
└── Hammer's Quests
    ├── GM Only
    │   └── The Sealed Invitation
    ├── Active
    │   ├── The Missing Silver
    │   └── The Lost Echo Blade
    └── Finished
        ├── Danger in the Skies
        └── The Broken Oath
```

- **Hammer's Factions:** Faction Journals are stored separately from Quests.
- **GM Only:** Quests that are **Unavailable** and have not been offered to new Characters. A new Quest is filed here.
- **Active:** Quests that are globally **Available**, whether any Characters have already accepted them or not.
- **Finished:** Quests the GM has administratively finished (internally `Inactive`), whether Characters succeeded, failed, or still have unfinished records.
- A Quest's owner Faction is stored as a **reference**, not a folder. A Quest can affect other Factions through its rewards or penalties.

**Important:** each Quest is **one shared native Journal**, and a native Journal has only one physical folder. Its location reflects the **GM's global administrative status**, not the result of any single Character. `Finished` can therefore contain mixed individual outcomes.


**GM Only access:** this folder is an *administrative category*, not a substitute for Foundry document permissions. New, unassigned Unavailable Quests have no player Observer access. If a previously shared Quest is later changed to Unavailable, its already-assigned Characters retain their historical results and existing legitimate Journal access; the Quest Manager flags this situation for GM review. The module does not silently revoke that access, fail participants, or discard history.

### World-wide module settings

Open **Game Settings → Configure Settings → Module Settings → Hammer's Quest & Renown → Open Settings** (GM only). In this single screen:

- **Class Sources and Enabled Classes:** use the two separate collapsible sections in World Module Settings. First expand **Class Sources** and check every class compendium (or World Items) permitted in the campaign. Then expand **Enabled Classes** to choose which logical classes may receive Class Specific rank benefits. A single Fighter slot accepts **every Fighter definition** found in the authorized Class Sources; PHB and custom supplement Fighters are not mutually exclusive. Each source document keeps its original UUID, source, and edition for future eligibility checks. Classes remain individually selectable without enabling the entire book's Feats or Spells, and empty Class Specific slots are valid. Both sections start collapsed to save space. Changing Class Sources does not automatically uncheck previously selected classes.
- **Folder Management:** customize the **name and color** of each of the five managed native Journal folders, or use **Reset Default Names** / **Reset Default Colors**. You can call your Quest root *Missões*, the GM-only folder *Ocultas*, and Finished *Concluídas* without altering their roles. Click **Save Settings** to apply changes to the current World. Existing Folder documents are renamed/recolored in place, retaining their IDs and all child Journals; Quest status rules never depend on the visible names. Folder names must not be blank or collide with another folder under the same parent.

Folder colors and names are World-wide settings for the GM; changes survive closing the configuration window and reloading the game. If you use a custom folder name, the module continues to move Quests by their global status into the same physical Folder IDs.

The Faction Editor is now dedicated to Faction properties, ranks, and optional benefit blocks. It no longer contains the global Class Catalog button. The World-wide class selection can be changed independently of any Faction.

### Global status vs. Character result

| Global Quest status (GM) | Journal folder | What it means |
| --- | --- | --- |
| **Unavailable** | GM Only | Prepared, but cannot yet be given to Characters |
| **Available** | Active | Can be given to eligible Characters and resolved with Success or Failure Turn-In |
| **Finished** (internally `Inactive`) | Finished | Closed to new Quest Giving and Success Turn-In; existing individual results remain unchanged |

| Individual result | Meaning |
| --- | --- |
| **Accepted** | Assigned to the Character, not yet resolved |
| **Completed** | The Character completed the Quest; success rewards were issued according to the Turn-In |
| **Failed** | A Failure Turn-In recorded failure for that Character |

Finishing a Quest **does not** fail pending Characters, take away Renown, revoke a previous success, or issue any other reward. The GM can use **Fail Turn-In** on a Finished Quest to resolve remaining Characters as Failed. To resume successful Turn-Ins, use **Reopen (Available)** first.

## Factions

Select **Factions** in the Journal Directory to create or edit a Faction.

A Faction has:

- **Name** and **public description** for its native `Faction Profile` Journal page.
- An optional **emblem/image**, selected with Foundry's built-in File Picker.
- **Renown ranks** with configurable minimum thresholds. Thresholds can be negative; each Faction has its own rank scale.
- A separate **GM Notes** page for secrets, NPCs, and campaign information.

The default ranks are:

| Rank | Minimum Renown |
| --- | ---: |
| Hostile | -25 |
| Unfriendly | -10 |
| Neutral | 0 |
| Friendly | 10 |
| Honored | 25 |
| Exalted | 50 |

These are editable defaults, not fixed rules.

**Faction discovery:** a Character or Group gains a recorded relationship with a Faction when it receives its first Renown ledger entry for that Faction. A **zero-point** manual adjustment is a useful way to establish a known Faction without changing the balance. Eligible Players receive read-only access to Faction profiles associated with their known Characters or Groups.

## Configuring Rank Benefits (Class Catalog)

Open **Factions**, select a Faction, and find **Renown Ranks**. In any rank,
choose **+ General** to add a reward block for every eligible Character, or
**+ Class Specific** to add a block with an empty row for each class selected
in the module's Class Catalog. You may add multiple blocks of both kinds to
one rank; ranks and class slots may remain completely empty. Use the X beside
an individual benefit block to remove it, then select **Save Faction**.

### Select which classes appear

1. As GM, open **Game Settings → Configure Settings → Module Settings**.
2. Under **Hammer's Quest & Renown**, click **Open Settings**.
3. Open **Class Sources**, the first collapsible section, and enable **all** class compendiums you want the campaign to recognize (plus World Items if desired). A class can be recognized from multiple books at the same time; this does not enable or restrict other game-system content.
4. Open the separate **Enabled Classes** section and check which logical classes should have Class Specific rank slots. Fighter needs to be checked only once even if two authorized sources contain a Fighter. The class count shows how many distinct authorized definitions exist, and the tooltip lists their provenance. This configuration does not grant Items to Characters.
5. Check or uncheck individual classes, then click **Save Settings**. This is independent of editing or saving a Faction.

On first use, only classes found in the D&D5e system's native **Classes (SRD)**
compendium are initially selected. Additional compendium and homebrew classes
must be enabled by the GM. Classes of the same name from approved sources share a logical slot, even if
supplements use different internal identifiers. The document UUIDs for **all**
authorized definitions are kept separately for future class eligibility; each
logical class still has only one row in the Faction rank editor. Custom classes
with distinct names can be enabled individually.

This is a **World-wide class selection**, shared by every Faction. Hiding a
class does **not** remove any previously configured rank data, change any
Actor's actual class, or block the use of Feats, Spells, equipment or other
Items from that compendium. Previously enabled classes whose sources are no
longer available are shown with a warning, rather than silently deleted.

**Current limitation:** General blocks and the individual Class Specific rows
are **placeholders only**. Item/Feat/Feature/Spell drag-and-drop and real grants
to Character sheets are planned for later development; nothing added to a rank
is granted to an Actor in this version. The Class Catalog only controls which
empty class slots are displayed and saved.

## Creating a Quest

Select **New Quest** or **Quest Manager → Create Quest**.

### Public information

The **Quest Editor** lets the GM configure:

- **Quest name** and **owner Faction** (an existing Faction is currently required).
- **Flavor Text** for the public Quest Briefing.
- **Objectives**, with checkboxes in the editor; these are shared Quest fields, **not separate per-Character objective trackers**.
- **Currency rewards:** Platinum, Gold, Electrum, Silver, and Copper pieces.
- **Item rewards:** drag Items from the World or Compendiums and set a quantity.
- **Renown rewards:** add separate signed Renown amounts for multiple different Factions. These do not need to match the owner Faction.

Players can read the public Quest Briefing, objectives, and announced success rewards when their User has access to the Journal. Item links can use Foundry's native UUID handling, with tooltip details where accessible.

### GM-only information

The Quest Editor also has:

- **Failure Penalties**, disabled by default. When enabled, define negative whole-number Renown changes against one or more Factions. These values are **not published** in the public Quest Briefing.
- **GM Notes**, stored in a separate protected Journal page rather than in the public page.

**After a Success Turn-In**, reward definitions are locked to protect previously issued per-Character rewards. **After a Failure Turn-In**, failure penalty definitions are likewise locked to protect existing failure records. Plan changes before issuing the first corresponding Turn-In.

A new Quest is saved **Unavailable** with no assigned Characters. Use the Quest Manager to change its availability and distribute it.

## Managing Quests

Open **Quest Manager** to find Quests in a preconfigured World without scrolling through a single long list. Use the five category buttons above the search box:

| Filter | What it shows |
| --- | --- |
| **All** | Every Quest, regardless of availability or outcome |
| **GM Only** | Globally **Unavailable** Quests, prepared but not currently available for Quest Giving |
| **Available** | Globally **Available** Quests with no pending assigned Characters (including Quests whose former participants already finished) |
| **Accepted** | Globally **Available** Quests with at least one unfinished assigned Character |
| **Finished** | Quests globally closed by the GM (`Inactive`), regardless of the individual Completed/Failed results |

Type in **Search by Quest or Faction** to narrow the current category. The numeric category counters respect the search term. Both the search and category controls filter the existing list without resetting your scroll position. The cards show a Quest's global availability, assigned Character count, and totals for active, completed, and failed Characters. All existing Journal, Editor, Giving, Turn-In, Failure, Undo and Results actions remain available when applicable.

**Important:** the **GM Only** filter now corresponds to the native `Hammer's Quests / GM Only` folder. **Accepted** remains only a manager view of Available Quests with unfinished Characters; it is not another physical folder. The module does not change Character results when re-filing a Journal. Previously shared Unavailable Quests remain visible to their authorized recipients, as explained under *GM Only access* above.

### Quest Giving

1. Make the Quest **Available**.
2. Select **Quest Giving**.
3. Select the Characters who should receive it; **Select All** and **Clear Selection** are available.
4. Confirm to mark each newly assigned Character **Accepted**.

A Character is eligible for Quest Giving only if it is a `character` Actor with an **explicit Owner permission for at least one non-GM User**. Merely belonging to a Group does not make a Character eligible. You may assign additional eligible Characters later, even if other Characters already completed the Quest. An already assigned Character cannot be given the same Quest twice.

The module grants eligible recipients **Observer** access to the Quest Journal, not Owner access. It does not assign Quests automatically to Groups.

### Success Turn-In

Use **Quest Turn-In** on an **Available** Quest:

1. Select the assigned, unfinished Characters who completed the Quest.
2. Review the configured rewards. Each selected Character receives the **full currency amount and full Item quantities**, directly into that Character's inventory.
3. Choose whether each configured Faction Renown line targets **Characters**, **Groups**, or both.
4. Optionally check **Represented Groups** drawn from the selected Characters' D&D5e Group memberships. Groups are **never preselected**.
5. Confirm **Complete & Grant Each**.

Each selected Character receives its own personal Renown amount for the relevant reward rows. An explicitly selected Group Actor receives the configured **collective Renown once per Quest**, rather than once per member. **Currency and Items are Character rewards; Groups do not receive those items or coins through this operation.**

A Character's Completion does **not** finish the Quest globally. Other assigned Characters can complete it later and receive their own rewards. Payout records help prevent duplicate distribution if an operation must be resumed.

### Failure Turn-In

Use **Fail Turn-In** on an **Available** or **Finished** Quest:

1. Select the assigned Characters who failed.
2. Review any enabled **Failure Penalties**.
3. Optionally select eligible represented Group Actors, and choose Character/Group targets for each penalty row.
4. Confirm **Mark Failed**.

The selected Characters become **Failed**. If no Failure Penalties were enabled, only the outcome changes. If configured, the module applies the selected **negative Renown** changes. It does **not** issue success currency, items, or success Renown. Group penalties are never automatic.

A previous **Completed** outcome is not overwritten by Failure Turn-In.

### Undo Failure

The **Undo Failure** action is GM-only and is intended for accidental Failure Turn-Ins.

1. Open the affected Quest in **Quest Manager** and select **Undo Failure**. It is also accessible from **View Results** where applicable.
2. Select the incorrectly Failed Characters; use **Select All Failed** for a batch correction.
3. Optionally choose Group penalty corrections when the affected Groups are eligible for reversal. Group correction is **independent** from Character selection.
4. Enter a **required reason** and confirm.

For the selected Characters, the module restores the previously recorded unfinished state where available, or **Accepted** for older failures without a prior-state record. Assignments and Journal access remain intact. Applicable Renown penalties receive **compensating positive ledger entries**; original transactions remain in the audit history. The correction is designed to avoid compensating the same penalty twice.

**Undo Failure does not reopen a globally Finished Quest.** If those Characters should successfully turn in the Quest afterward, select **Reopen (Available)** separately.

> Undo Failure is **not** a general Undo Success function. Do not use it to try to withdraw currency, items, or Renown from a previously Completed Character.

### View Results

The GM can open **View Results** to inspect individual Character statuses, completed Turn-Ins, Failed Turn-Ins, selected Groups, Renown effects, and recorded failure corrections. Results are read-only and preserve historical records.

### Finish or reopen a Quest

- **Finish Quest** moves the Journal to `Hammer's Quests / Finished` and keeps every Character's current result intact.
- **Reopen (Available)** returns it to `Hammer's Quests / Active`; a previous `Completed` or `Failed` result does not reset just because the Quest was reopened.

## Reputation and Renown

Renown is recorded **per Actor** and **per Faction**. A Character's reputation is independent from the reputation of a Group Actor, even if the Character is a Group member.

### Native Reputation tab

On supported D&D5e Character and Group sheets, open **Reputation** to see each known Faction's:

- Name
- Current rank
- Current Renown and the Faction's maximum rank threshold, displayed compactly as `current / max`

**A Character sheet shows only that Character's personal Renown. A Group sheet shows only that Group Actor's Renown.** Balances are not automatically combined, inherited, or shared.

### Reputation Manager

Open **Renown** from the Journal Directory, or **Manage** from a supported Reputation tab.

GM capabilities include:

- Select **one or many Characters** using checkboxes, search, and Select All/Clear controls.
- Select **Group Actors separately**; selecting a Character never automatically selects their Group.
- Choose a Faction and enter a **positive, negative, or zero** whole-number adjustment.
- Enter a **required reason** and review the projected balance for each selected Actor before recording.
- Inspect a Character's or Group's existing Factions and history without changing the selected adjustment recipients.
- Review the **five most recent events** or open the full, paginated history.

Each recipient receives the **full amount entered**. For example, a `+5` adjustment applied to three Characters gives **+5 to each**, not a total of five points distributed among them.

Players can view their permitted reputation information, but **only the GM can change Renown**.

## What players see

Players continue using Foundry's **native Journal Directory** and supported **D&D5e Actor sheets**.

- Quest Journals are read-only and shared with Players whose Users explicitly own assigned Characters.
- Public Quest pages show the briefing, objectives, assigned Characters, and announced rewards.
- A personalized panel shows **Quest Accepted**, **Quest Completed**, or **Quest Failed** for the selected Character. Completed uses a simple green check seal; Failed uses a red cracked-X seal.
- If a User owns multiple assigned Characters, the panel offers a **Character selector** to switch the displayed outcome.
- Faction profiles become readable when an eligible Character or Group has a Renown record for that Faction.
- **Private GM Notes remain hidden**, and optional Failure Penalties are not listed in the public Quest Briefing.

**Permission model:** Foundry Journal permissions belong to **Users**, not individual Characters. The Character selector personalizes the result panel; it is not an independent, Character-level security boundary. A User who owns several Characters may be able to access a shared Quest Journal through any one of them.

## Reliability and safe operation

This module stores Quest and Faction data in **native `JournalEntry` documents**, and Renown history in **Actor flags**. It does not require a separate database, duplicate a Journal for each recipient, or depend on Character Builder.

To keep a campaign safe:

1. **Back up before updating**, particularly if the World already contains paid Quests or reputation history.
2. Avoid having **multiple GM clients run the same Turn-In or batch adjustment at the same time**. Foundry document changes across multiple Actors are not an atomic database transaction.
3. If an operation was interrupted, use the relevant **Resume** option in the module instead of repeating it as a new operation or editing flags manually.
4. Use **View Results** and the Reputation history to audit awards, penalties, and corrections.
5. Use **Finish Quest**, **Fail Turn-In**, and **Undo Failure** for their separate purposes; one does not implicitly perform the others.

Versioned migration logic is included for the module's existing managed campaign records. The Active/Finished filing also preserves native Quest Journal IDs and moves only documents identified as belonging to the module.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| A Character is missing from Quest Giving | The Actor must be type `character` and have **explicit Owner** permission for at least one non-GM User. Group membership is not sufficient. |
| Quest Giving or Success Turn-In is unavailable | The Quest must be **Available**. A Finished Quest must be reopened first. |
| A Quest is in `Finished` but a Character still shows Accepted | This is expected: **Finish Quest does not automatically fail or complete Characters**. Use Fail Turn-In only if a failure is intended. |
| A Character was marked Failed by mistake | Use **Quest Manager → Undo Failure**, select that Character, and give a reason. Reopen the Quest separately if needed. |
| A Group received no Renown | Groups must be **explicitly selected** during Turn-In, and the relevant reward/penalty line must target Groups. |
| A Faction is missing from a Character's Reputation tab | That Actor may have no ledger entry for the Faction. A GM can record a **zero-point adjustment** to establish the relationship. |
| A payout or correction was interrupted | Reopen the operation and use its **Resume** action; do not create a duplicate operation. |
| The Reputation tab is absent from a custom Actor sheet | The tab targets native D&D5e sheets; try the available **Reputation** header control or the Journal Directory **Renown** button. |

If you encounter a bug, include your Foundry version, D&D5e system version, module version, and relevant console messages in a [GitHub issue](https://github.com/hammer-PvP/Hammer-s-Quest-Renown/issues). Please avoid posting private campaign data or player information publicly.

## Current scope and limitations

- A new Quest **requires an existing Faction** as its owner. Standalone factionless Quests are not supported yet.
- Quest progress and Turn-In outcomes are **individual per Character**; Group membership does not automatically copy personal progress or Renown.
- Objectives belong to the shared Quest document; **independent per-Character objective completion** is not provided.
- Failure Penalties currently affect **Renown only**. Automatic currency deductions and Item removal are not part of Failure Turn-In.
- **Undo Failure** is supported; automatic reversal of a successful Turn-In's currency and Items is not.
- No built-in automatic quest prerequisites or quest chains. Rank Benefit blocks can be saved, but they do not yet grant Items or abilities to Characters.
- The native Journal folders `Active` and `Finished` express **global Quest administration**, not personalized folders per player.

For technical changes by version, consult [CHANGELOG.md](CHANGELOG.md) and [GitHub Releases](https://github.com/hammer-PvP/Hammer-s-Quest-Renown/releases).

## License and credits

**Hammer's Quest & Renown** is developed by **Raphael Andrade** and released under the [MIT License](LICENSE).

Designed for [Foundry Virtual Tabletop](https://foundryvtt.com/) and the [D&D5e system](https://github.com/foundryvtt/dnd5e). These are separate projects and are not bundled with this module.
