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

## 1.1.0 — GM Assistant integration

Protocol implementation was checked against GM Assistant's official v1 OpenAPI specification, including campaign/session pagination, the notes text facet, the canonical default recap, and scene descriptions/key events. No user credential was available, so authenticated calls against a real account remain unverified.

Additional automated coverage includes:

- Source-linked imports, prevention of duplicate session cards, and unchanged-source detection.
- Resync of remote text and titles while retaining world/chapter, coordinates, classification, thumbnails, recap images, and inserted inline images.
- Read-only companion routes, pairing authentication, exact Origin/Host checks, preflight, rejection of write methods, and rejection of unrelated API endpoints.
- HTML escaping, safe Markdown images, and source metadata persistence.
- Browser integration workflow with a mock GM Assistant API: connection, campaign selection, full-note fetching, per-session world/chapter/position selection, classification selection, image insertion and preview, resync, and atomic failure handling.

Run `node tests/test_model.mjs`, `node tests/test_gma.mjs`, and `python3 tests/test_bridge.py` from the repository. Foundry's native file picker and a live GM Assistant account still require end-to-end verification on the user's installation.

## 1.1.1 — companion input fix

Replaced hidden console input with a Tk setup window, explicit clipboard buttons, a visible-editable masked key field, optional key reveal, and copyable pairing details. Automated setup-controller tests cover clipboard replacement, validation, starting the real loopback service, authenticated status reads, copying the token, stopping, and clearing credentials. These controller tests use mock widgets; a native Windows desktop check remains pending. Existing companion boundary tests also pass.

## 1.1.2 — mixed-world placement and linked-note recovery

Fixed the default-world control requiring a separate Apply click, saved placements directly from visible controls, and removed misleading editable placement controls on already-linked sessions. Added an offline linked-note manager with actual saved locations, Locate, individual/bulk moves, and connection cleanup when scopes change.

Regression tests cover a single campaign imported into different worlds with different chapter scopes and coordinates, automatic defaults without Apply, linked-note Locate for an off-screen entry, moving an existing entry without duplication or loss of its source/content/artwork, and read-only destination controls when reimporting a linked session. Unit tests cover moving notes individually and as a connected group. Tests use the existing browser harness rather than a running Foundry world.
