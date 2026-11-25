# Validation — 1.0.0

Passed automated checks:

- Syntax checks for all JavaScript modules.
- Import schema checks, duplicate-ID rejection, numeric bounds, invalid links, HTML escaping, and unsafe media URL rejection.
- Data export/import roundtrip and chapter association preservation.
- Player-facing rendering excludes edit controls.
- Chromium interaction tests using the module's actual HTML, CSS, and scripts with a small Foundry API harness:
  - Quest selection and related-picture recap viewer.
  - Background path, opacity, and grayscale persistence.
  - Chapter creation, entry, quest creation, and return navigation.
  - Different timeline thumbnail and recap-picture paths.
  - Dragging cards and saving positions.
  - Classification profile creation with a custom icon.
  - Selecting the saved profile for a new quest, reusing its icon without an additional upload.
  - Planet creation and switching.
  - JSON download and re-import.
  - GM-only API mutation checks and player navigation.
- No uncaught browser JavaScript errors in the tested workflow.

The browser harness simulates Foundry's ApplicationV2 lifecycle, settings, file-picker callback, and user role. It is not a licensed running Foundry world. The actual Foundry server, native file picker, keybindings, module-settings menu, sidebar hook, and multi-client notifications still need an in-world verification on Foundry 14.

The uploaded reference video was inspected directly for planet/chapter/quest organization, card layout, branching lines, selection, detail panel, and recap navigation. This module uses original styling and configurable still images; it does not bundle or run the game.
