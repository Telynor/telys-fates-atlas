# Tely’s Fate’s Atlas — 1.0.0

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

## Backups

In Edit mode, **Export** downloads a JSON backup. **Import** validates and replaces the atlas after its replacement checkbox is checked. Export before replacing or deleting content. Deleting a chapter moves its child quests to the planet overview; deleting a planet deletes its cards.

Backups contain artwork paths, not image bytes. Copy the images separately when moving worlds. World settings store the data, so your normal Foundry world backups also include the atlas.

## Macro and API

Create a Script macro with:

```js
game.modules.get('telys-fates-atlas').api.open();
```

The included `Open-Fates-Atlas-Macro.js` contains the same launcher.

```js
const atlas = game.modules.get('telys-fates-atlas').api;
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
