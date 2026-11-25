# Tely’s Fate’s Atlas — 1.1.3

A system-independent Foundry VTT 14 module, built around the supplied Fate’s Atlas video reference: planet navigation, branching illustrated chapters, chapter-specific quest timelines, a right-hand quest panel, and picture recaps.

## Install with Foundry

In Foundry's **Add-on Modules → Install Module**, paste this Manifest URL:

```text
https://raw.githubusercontent.com/Telynor/telys-fates-atlas/main/module.json
```

Install, open your world, and enable **Tely’s Fate’s Atlas** in Manage Modules. Press **Shift+F** to open it.

## Manual installation

1. Close Foundry.
2. Extract the downloaded archive into your Foundry **User Data / Data / modules** folder. Rename the extracted folder to `telys-fates-atlas` if GitHub appends a version suffix. The result must be `Data/modules/telys-fates-atlas/module.json` (avoid an extra nested folder).
3. Start Foundry, open your world, and enable **Tely’s Fate’s Atlas** under Manage Modules.
4. Press **Shift+F**, click **Fate’s Atlas** in the Game Settings sidebar, or open Configure Settings → Module Settings → Fate’s Atlas → Open Fate’s Atlas.

No D&D5e, Midi-QOL, libWrapper, or other module is required. No remote game assets are fetched. Provide your own artwork through Foundry’s file picker.

## Make your atlas

- Start with **Edit atlas → + Planet**, or choose **Load example atlas** from an empty atlas.
- Use **Planet settings** for the name, planet order, optional symbol, subtitle, and full-color background image. Background opacity and grayscale are separate settings from 0 to 1. The browser applies both filters; the file stays unchanged.
- Use **+ Quest / Chapter** to create a card. Its name appears on its colored mission label.
- For a large story arc, set **Card behavior → Chapter**. Clicking it opens its own timeline. Create quests while inside the chapter, or assign their **Inside chapter** dropdown.
- Set **Timeline card image** to the thumbnail on the timeline. Set **Related picture** to the illustration displayed in the quest panel and in the full Recap viewer. These can be different images. If Related picture is empty, the thumbnail is used.
- Set mission type, description, chapter label, and status. Available, In progress, Completed, and Locked have distinct appearances. Locked is a visual marker and does not block viewing.
- Select predecessor cards to draw branch connectors. Only cards at the same level can connect. Multiple preceding cards are supported. No automatic chronology or prerequisites are imposed.
- Drag cards in Edit mode to arrange them freely. Positions snap to 10 pixels. The numeric position fields are available for precise placement. Turn off Edit mode to browse.
- Select **Classification profiles** to create reusable quest classifications. Each profile saves a name, color, symbol, and optional icon image. Pick the **Classification profile** dropdown when editing any quest to reuse its saved icon without uploading it again. A live preview shows the selected profile. Editing a profile updates all quests using it. Removing a profile reassigns its quests to the first remaining profile.

## Browse

Choose a planet from the top dropdown or adjacent arrows. Click a chapter to enter it and use the back arrow to return to its planet. Click a quest to open the detail panel. Its related picture appears immediately; click the picture or **Recap** to enlarge it. Close the viewer to return to the timeline.

Drag empty space to pan. Scrollbars support longer branches and timelines. Use the bottom slider or +/- buttons to zoom; **Fit** frames the current timeline. Resize the Foundry window as needed. Changes are saved automatically after each editor save or card move.

Players can view the atlas. Only GMs can change it. The atlas is shared campaign information: do not enter secret material until it should be visible to players. There are no hidden/private quest records.

## Import from GM Assistant and Resync

This integration uses GM Assistant's official v1 API. It reads existing notes; it never uploads recordings, starts analyses, spends credits, or writes back to GM Assistant.

### One-time connection setup

1. Sign in to [GM Assistant](https://gmassistant.app/) in your normal browser. Open **Account → Developer** and create a **read** API key. The service's documented integration authentication is an API key, not third-party account/password login.
2. Locate this module's **companion** folder inside `Data/modules/telys-fates-atlas`. On Windows, double-click **Start-Windows.bat**. It requires Python 3.10 or later. On macOS/Linux, run `python3 companion/gma_bridge.py`.
3. In the companion setup window, paste your Foundry browser URL into **Foundry URL** and paste the API key into **GM Assistant read API key**. Both fields have Paste buttons; the key field displays asterisks and has a Show API key checkbox. Click **Start companion**. The key stays in the companion process and is never stored in the atlas or sent to players. Optionally supply it through the `GMA_API_KEY` environment variable on the companion computer.
4. Keep the companion setup window open. In Fate’s Atlas, click **Import from GM Assistant**. Click **Copy pairing token** in the companion and paste it into the importer and click **Connect / Load campaigns**. Allow local-network access if your browser asks.
5. The pairing token is saved only in this browser's client settings. Restarting the companion creates a new token; pair again after a restart. The companion must run on the computer where the GM's Foundry browser is open, even if the Foundry server is hosted elsewhere.

### Import a campaign

1. Choose the D&D campaign from the campaign dropdown.
2. Choose the notes format. **Long-form** combines the canonical full recap, session notes, and detailed scene outline/key events. Recap-only, notes-only, and scene-only formats are available.
3. Click **Fetch campaign notes**. All sessions are read in GM Assistant's campaign order, including paginated results.
4. Choose the default world, chapter, saved classification profile, status, first X/Y position, horizontal spacing, and optional title prefix. Defaults immediately apply to sessions that have not been individually customized. **Apply defaults to all selected sessions** explicitly overwrites selected sessions’ individual placements.
5. Adjust individual sessions' world, chapter, classification, and X/Y positions where needed. Uncheck sessions you do not want to import. Expand a session's preview to inspect its fetched text.
6. Click **Save** to create the linked Atlas quest cards. Empty sessions and sessions already linked anywhere in this world’s atlas are skipped. Session cards can be connected consecutively. Large imports wrap onto additional rows when they reach the maximum horizontal coordinate.

The importer does not choose the world or chronology from prose. Your chosen placements are authoritative. New campaign imports become shared Atlas content visible to players; preview them before saving.

### Formatted text and images

Edit a quest to work with **Description / campaign notes (Markdown)**. Headings, paragraphs, bullets, bold, italic, code, and inline image Markdown are displayed as formatted content in both the quest panel and Recap viewer.

Use **Insert image** to select or upload an image through Foundry's file picker at the text cursor. Use **Preview formatting** to see the result. Timeline thumbnails and Recap cover pictures remain separate from inline images. Raw HTML in source notes is escaped.

### Resync

Click **Resync** in the atlas toolbar, or **Resync all linked notes** in the importer, to fetch every linked session again. Changes to remote titles and source text update the matching entries without creating duplicates.

Resync preserves the entry's world, chapter, X/Y position, branch connections, classification, quest status, timeline image, and Recap cover. Locally inserted inline images are retained near their named source section. If a section has disappeared, its images move to the end. Clearing the source notes also clears the imported prose while keeping locally inserted images. Source text and titles follow GM Assistant; local prose edits are replaced when the remote notes change. To keep an independent copy, open its quest editor and select **Unlink this quest from GM Assistant**.

Resync does not automatically import newly added sessions: use the importer again to choose their placement. Already linked sessions show their actual saved world/chapter and cannot be assigned another destination through the importer. Use **Linked notes** to move them. If any source read fails, the batch is left unchanged so you can correct the source/connection and retry. There is no scheduled background sync.

### Connection troubleshooting

- **Cannot reach companion:** keep its setup window open and use its local address. Browser access to localhost is required.
- **Origin not paired:** restart the companion with the exact URL used in the GM's Foundry browser, including its port. Origins differ between `localhost` and `127.0.0.1`.
- **Rejected key:** generate a valid read API key in GM Assistant and restart the companion.
- **Source deleted:** unlink that quest if you want to retain its old content, then resync the remaining links.
- **Rate limit:** wait for the displayed Retry-After interval and try again. The module does not immediately retry rate-limited calls.
- On a machine without Python, install Python 3.10+ from the official Python website first. This release includes companion source and a Windows launcher, not a standalone executable.

Official protocol references: [Developer Quick Start](https://gmassistant.app/docs/api/quick-start/), [Conventions](https://gmassistant.app/docs/api/conventions/), [OpenAPI specification](https://backend.gmassistant.app/v1/openapi.yaml).

## Backups

In Edit mode, **Export** downloads a JSON backup. **Import** validates and replaces the atlas after its replacement checkbox is checked. Export before replacing or deleting content. Deleting a chapter moves its child quests to the planet overview; deleting a planet deletes its cards.

Backups include the GM Assistant source links, so imported entries stay linked after a restore. API keys and companion pairing tokens are excluded. Backups contain artwork paths, not image bytes. Copy the images separately when moving worlds. World settings store the data, so your normal Foundry world backups also include the atlas.

## Macro and API

Create a Script macro with:

```js
game.modules.get('telys-fates-atlas').api.open();
```

The included `Open-Fates-Atlas-Macro.js` contains the same launcher.

```js
const atlas = game.modules.get('telys-fates-atlas').api;
await atlas.importFromGMA(); // GM only; opens the import wizard.
await atlas.resyncGMA();     // GM only; updates linked source notes.
atlas.open({ planetId: 'PLANET_ID', chapterId: 'CHAPTER_ID' });
const profiles = atlas.getClassificationProfiles(); // Saved icon/color presets.
const data = atlas.exportData(); // Returns a copy, not live data.
await atlas.importData(data);   // GM only; validates and replaces data.
await atlas.loadExample();      // GM only; requires an empty atlas.
```

Classification profiles can also be programmed through the API. Preserve existing profile IDs when updating them:

```js
const atlas = game.modules.get('telys-fates-atlas').api;
const profiles = atlas.getClassificationProfiles();
profiles.push({
  id: 'main-story', name: 'Main Story', symbol: '✦',
  color: '#e8cd85', icon: 'worlds/your-world/icons/main-story.webp'
});
await atlas.saveClassificationProfiles(profiles); // GM only.
```

Profiles are stored with the world and included in JSON backups. Their icon paths point to one reusable file; uploading new artwork per quest is unnecessary.

## Scope and validation

This version implements the reference’s planet → chapter → quest organization, card frames, branching lines, zoom controls, selection brackets, quest panel, and recap navigation using original HTML/CSS. It uses still images for recaps as requested. It does not replay Star Rail gameplay, video cutscenes, or dialogue choices, and it does not include the game’s proprietary icons, fonts, or backgrounds. It is not a pixel-for-pixel copy of the game engine UI.

Target: Foundry VTT 14, ApplicationV2. JavaScript syntax, data validation, nested timeline rendering, safe image paths, and escaped user content have automated checks. See VALIDATION.md for the final test results and runtime limits.

### Companion input fix (1.1.1)

The Windows launcher now opens a standard setup window instead of hidden terminal input. Close the old terminal before starting the updated launcher. Use Paste API key, Start companion, and Copy pairing token. The optional `--console` mode uses visible input for environments without a graphical desktop. API keys remain in process memory and are cleared when the companion stops.

## Repairing or finding linked imports (1.1.2)

Click **Linked notes** in the atlas toolbar or importer. Every linked session lists its actual saved world, chapter, and X/Y coordinates. **Locate** opens that world and chapter and centers the note, even if it was off-screen.

To repair a misplaced import, change its **World** and **Chapter** in this panel, then click **Save**. Editing a destination automatically selects that note for saving. For a batch, select the notes (or filter and select visible notes), choose the bulk world/chapter, click **Apply world/chapter to selected notes**, then **Save**.

These operations move the original records: their IDs, text, source links, artwork, status, and classifications are retained. Connections between notes moved together are retained when they stay in the same destination scope. Connections that now cross a world or chapter boundary are removed.

The placement wizard now reads each visible row directly on Save and does not require a separate default-application click. Individually customized rows retain their overrides when defaults change. A destination summary shows the import counts for each world before saving; the completion notification also reports the saved counts by world. After import, the first new note is opened in its destination and centered.

Existing notes are never automatically moved based on a guess about which world they belong to. Use Linked notes to review and correct existing placement.

## Open companion button (1.1.3)

The importer now has an **Open companion** button. An already connected graphical companion is brought forward through its paired local connection.

To launch a closed companion from this button on Windows, run the updated **companion/Start-Windows.bat** once and click **Enable Atlas launch button (Windows)** in its setup window. This registers the dedicated `tely-fates-atlas:` app link for your current Windows user, pointing only to this companion script. No administrator access is needed. Re-enable the button if the module folder or Python installation moves. Windows or the browser may ask you to confirm opening the registered companion app.

After that one-time setup, **Open companion** launches its window directly. Existing companion windows are brought forward instead of creating a second setup window. The launch link contains no API key, pairing token, or server URL; keys remain in the companion process. The companion still needs its key and Start action after a fresh launch. The registered app link is currently Windows-only.

The local `/open` action requires the same exact Foundry origin and pairing token as note reads. It raises the GUI and does not write to GM Assistant. Console-mode users should continue using their console window.

## Notes that appear to vanish (1.1.3)

- World navigation remembers its chapter, selected note, zoom, and scroll position during the current Atlas session. First visits frame the current timeline rather than always showing coordinate zero.
- **Fit** frames the actual card area, including far-away notes, and supports zooming out further for large timelines.
- **World notes (N)** lists every saved quest in that world, including other chapters. Open any entry to navigate directly to it.
- Imports and linked-note moves default to **Separate overlapping cards/notes automatically**. A requested position that collides with an existing card is shifted to free space. Turn this off only when you deliberately want exact overlapping placement.
- For notes already stacked on top of one another, open **Linked notes**, select those notes, leave **Separate overlapping notes automatically** enabled, and click **Save**. Their text, images, classifications and source links stay intact.

These changes address visibility and overlapping placement. They do not silently delete, reimport, or move records to a guessed world. If a record is absent even from World notes and Linked notes, export the Atlas JSON for direct inspection.
