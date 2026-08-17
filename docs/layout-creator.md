# Layout creator

AI implementation context for the in-progress layout creator: a dedicated page where people
draft layouts, try them with the same practice workspace as a catalog layout, and save those
drafts in the browser.

## Product model

- The shared app bar includes **Discover** and **Create** choice-chip links to the right of the
  logo. Discover goes to `/` and stays current on layout show pages. Create goes to
  `/create?edit=1`.
  Idle links are muted text with no chip. Hover shows a neutral pill and primary text. The
  current route uses `aria-current="page"` with accent text on an accent-tinted pill. Below the
  `md` breakpoint the Emulayout wordmark is hidden and the home link keeps only the logo icon.
- `/create` replaces index or detail content while preserving the rest of the app bar, including
  Discover, Create, the Quick Find search field, Compare, help hints, theme controls, and the home
  link. Quick Find is a pill search control that opens the existing modal; the other action icons
  sit on the app-bar background and show a circular hover highlight.
- The page uses index-style view tabs, not detail-page section tabs. An unsaved canvas is the first
  tab, labeled with the live draft name. Each saved layout is an additional tab labeled with its
  stored name (the live name while that tab is active). Saving the unsaved canvas turns it into a
  saved tab. Switching tabs loads that layout's snapshot into the editor. When at least one saved
  layout exists, a `+ New layout` button sits on the far side of the tab bar and starts a blank
  unsaved canvas in Edit (`/create?edit=1`) without leaving `/create`. It is hidden while there are
  no saved layouts, because the unsaved canvas tab is already showing. Saved tabs include the same pointer X as index view tabs;
  Delete or Backspace on a focused saved tab opens the same style of confirmation. Deleting a
  saved layout removes it from local storage. Deleting the active layout starts a new canvas;
  deleting another tab leaves the current draft in place. The unsaved canvas tab has no delete
  control.
- The New layout canvas starts as a stagger QWERTY board named `New layout`. Layout name and
  author name fields sit above Input layout. On a wide header they share the row equally; when
  that space is too narrow they stack. The name updates the live draft; an empty value falls back
  to `New layout`. Author is optional and stays empty until typed. The author field is a
  combobox over catalog authors: type to search, use the chevron for the full list, and keep a
  freeform name if it is not in the catalog. The document title and the
  active tab use the layout name. Renaming does not regenerate the practice words. Preview uses the
  same two-column show-page layout as `/layouts/[name]`: a summary card on the left and Typing
  practice, Layout test area, and Layout feel on the right. The card shows the live name and
  author. Local drafts have no analyzer stats, so the card uses the unavailable presentation with
  the subtitle `Local layouts have no analyzer stats.` There is no card analyzer selector, no Stats
  tab, and no cminibrowser link. Cyanophage and Colemak Camp links stay when they can be built from
  the live keymap.
- The current draft is the `/create` query string, using the same replace-state sync as the index.
  Name, author, base layout, keyboard type, key grid, preview, practice lesson, the Practice /
  Test / Feel `tab`, Magic/Adaptive
  mappings (including incomplete rows), and which complete special mappings are disabled are
  written when they differ from the blank canvas. An active saved
  layout also writes `id` (a local-storage UUID). When that saved layout is unchanged, other draft
  params are omitted so the URL is `/create?id=<uuid>`. Opening that clean saved URL, or switching
  to a saved tab, starts in Preview. Preview is the default view and is not written to the query.
  Edit writes `edit=1` and does not count as a saveable change. The shared show-page `tab`
  param keeps Typing practice, Layout test area, or Layout feel across refresh; it is omitted
  at Typing practice and is not a saveable change. Invalid or `stats` values become Typing
  practice. Dirty edits stay in the query
  alongside `id` so a refresh keeps them. Writes wait 300ms after the last edit, matching the
  index filter URL persist, and flush on page hide so a refresh keeps the latest keystrokes. The
  Create link and **+ New layout** start a fresh canvas in Edit (`/create?edit=1`). A bare
  `/create` opens Preview of the default canvas. Reloading or opening the URL restores the draft,
  and a known `id` restores that saved layout from local storage. Empty standard slots are omitted
  from `keys`; a cleared board is `keys=v1:-`. Do not put draft names, saved ids, or key maps into
  GoatCounter paths or events.
- In Edit, the typing-practice keyboard slot shows the editable key editor instead of the
  presentation preview. Base layout (optional) and keyboard type sit above that editor. Choosing a
  catalog layout seeds the key grid, keyboard type, and that layout's default Magic and Adaptive
  mappings; empty slots stay optional, so a draft may use fewer or more assigned characters than
  the base. The editor keeps the full QWERTY slot grid and sizes that grid to the page, so unused
  punctuation columns do not overflow. Printable keys replace the focused slot and advance, Backspace/Delete clear, and arrows
  move among slots. Typing `@` or `*` into a slot adds that trigger to Magic mappings when it is not
  already present, and turns Magic on. `@` starts as fallback-only (otherwise → repeat previous),
  with no empty mapping row; Add mapping still adds rows. `*` uses the empty Magic section. If Magic
  is still unused and the first typed trigger is `@`, the placeholder `*` section is omitted.
  Clearing `@` or `*` from a slot does not remove its mapping.
  Keyboard type is Ortho or Staggered. Thumb keys use the same left/right
  separation as the presentation keyboard, with an empty spacebar-sized gap
  between hands, including when both thumbs emit the same character. Assigned values may repeat and stay on
  their own slots, so several keys can output the same character. Empty slots are omitted from the
  live draft. Edits update the in-memory layout immediately so every Edit typing tab uses the
  current keys. The same workspace options paint that editor: next-key outline, home-key coloring,
  special-key fills and emitted values, Adaptive swap paths, and unreachable slashes. While a key
  field is focused, the typed value stays visible instead of the contextual overlay.
- Preview keeps `LayoutExpandedView` in local-preview mode and shows the summary card. The card
  and right-hand tabs match the catalog show page, except stats stay unavailable, the card analyzer
  selector and Stats tab are omitted, and the cminibrowser link is hidden. Edit hides that summary
  column so the tabs and workspace fill the panel. The preview keyboard still
  draws the 10 keys on each letter row and empty keycaps for unassigned slots between letters so
  remaining keys keep their physical columns. The key editor, name and author fields, base-layout
  and keyboard-type fields, special-key add buttons, missing-letter warning,
  and editable mapping panels are hidden until Edit again. The catalog mapping panel still appears
  in the practice workspace when the draft has complete Magic or Adaptive mappings, even if those
  editors were closed in Edit. The sticky bar shows **Preview** while editing, which opens this
  show-page preview, and **Edit** while previewing.
- While in Edit, Magic and Adaptive add buttons sit to the right of the keyboard in their
  own column, top-aligned with the first keyboard row. Either or both can be on. Magic adds a `*`
  trigger (or keeps one already on the board); Adaptive sets the draft's adaptive-swap flag.
  Clicking an active button hides that editor without discarding the draft. The icon fill lights up
  when that feature is on and at least one complete mapping is enabled. Closing the editor while
  complete mappings remain tints the icon and label in the Magic or Adaptive color so the saved data
  is still visible.
  Panel visibility is transient UI state, separate from the persisted feature flags and mapping
  drafts. Reopening Magic or Adaptive restores the same data; hiding a panel never removes its URL
  or saved-layout payload.
- When a special key is on, its mapping editor appears in a separate column to the right of those
  buttons. Opening a panel does not move the icon column. Magic and Adaptive never share a panel.
  Each panel can add, edit, and delete mappings,
  add or delete labeled sections (Magic: extra triggers; Adaptive: schema groups), and temporarily
  disable complete mappings with the same checkboxes as the catalog selectors. Those enabled and
  disabled states are part of the draft: they stay in the URL, count as a saveable change, and
  restore with a saved layout. Each Magic section
  also has the schema fallback: nothing (`no-op` / omitted), repeat previous, or fixed text. Fixed
  text stacks under the fallback selector in the same field column. Rule and fallback rows share
  columns so the trigger and output line up; the preceding field fills the space before the trigger.
  A trigger can live on an emitting
  fallback alone. Incomplete rows stay in the draft and are omitted from the live practice profile.
  A caution warning sits under the keyboard, before the workspace options. It lists A–Z letters
  missing from the keyboard. A Magic emit or emit fallback can cover a missing letter only when
  that trigger is on the board and the mapping is enabled. Mapping keys that are not letters,
  including a missing Magic trigger, are not listed. The key list wraps inside the keyboard width
  so a long set of missing letters does not scroll the page sideways. The warning is Edit-only.
- Edit and Preview share the show-page **Layout detail sections** tabs: Typing practice, Layout
  test area, and Layout feel. There is no Stats tab. The selected tab is the `tab` query
  parameter, matching catalog show pages, so a refresh or shared `/create` link keeps it.
  Toggling Preview/Edit keeps the selected tab. Opening a saved layout, a new
  canvas, or a duplicate resets to Typing practice. In Edit, every section keeps the key editor,
  name and author fields, base-layout and keyboard-type fields, special-key add buttons,
  missing-letter warning, and editable mapping panels, so the user can test the live draft in
  Typing practice, Layout test area, or Layout feel. Typing practice and Layout feel share the
  page-session leftover lesson words; leaving either tab during a test refills a random lesson to
  ten words and clears the timer. Layout test area keeps its own free-typing surface.
  Each tab still uses its own keyboard options. Preview swaps that editor for the presentation keyboard.
  Edit-only Practice and Feel use a compact scale for the prompt, input, and score
  stats so they sit more tightly above the key editor. Edit Layout test area free
  typing uses a 130px field instead of the tall show-page surface. Preview and
  catalog show pages keep the large practice typography and tall test area. In
  Edit the section tabs, prompt, and input match the key-editor workspace width.
  Preview keeps the show-page column. The same
  Practice lesson settings control as the detail page
  can replace that lesson with custom `text` or raise the Magic/Adaptive word share with
  `special`. Those params join the creator query and are omitted at their defaults. Magic and
  Adaptive mapping controls appear when the draft has those features, using the same workspace as
  the detail page.
- Creator visits use document scrolling at every viewport width, matching layout detail pages.
- Direct `/create` links are first-class. The route is prerendered so GitHub Pages can serve it
  without relying on the SPA fallback.
- Saved layouts persist in a versioned local-storage document, each with its own id. A sticky
  bottom bar keeps **Preview** / **Edit** beside save while the page document-scrolls.
  Save follows the live canvas: **Save layout** on an unsaved draft; a split **Update layout** with
  **Save as new layout** when a saved layout has changed, plus **Undo changes** to the right of
  that split; **Duplicate layout** only when a saved layout matches its stored snapshot. Duplicate
  saves a new copy, opens it in Edit, and increments a trailing copy number: `My layout` becomes
  `My layout 2`, `Vylet v5` becomes `Vylet v5 2`, and `Test 3` becomes `Test 4`. Undo restores the
  stored snapshot and keeps the current Preview/Edit mode. It is hidden on an unsaved canvas and
  while a saved layout is clean. Save, update, and save-as-new use the current layout name. A save is only acknowledged after local storage confirms the write. If storage is
  unavailable, the creator keeps the full draft URL and shows a recoverable error instead of
  switching to an id-only URL. Open creator tabs synchronize saved-layout changes, and writes merge
  stable ids so one tab does not discard layouts saved by another. They do not send analytics events.

## Deferred work

- Repeat mapping editors.
- Renaming saved drafts from the tab bar.

## Code map

- Default canvas, tab values, duplicate names, and key-editor conversion: `src/lib/layoutCreator.ts`
- Shareable `/create` query codec: `src/lib/layoutCreatorUrl.ts`
- Saved-layout local-storage document and session restore: `src/lib/layoutCreatorStorage.ts`
  (`resolveCreatorSession`, `snapshotForSavedLayoutView`)
- Draft Magic/Adaptive mapping sources, catalog seeding, and compilation: `src/lib/layoutCreatorMappings.ts`
- Catalog layouts and supplemental mappings: `src/lib/layoutsCatalog.svelte.ts`
- Creator page chrome, live key editor, and practice workspace: `src/lib/components/LayoutCreator.svelte`
- Shared string autocomplete and domain adapters: `src/lib/components/TextAutocomplete.svelte`,
  `src/lib/components/LayoutAutocomplete.svelte`,
  `src/lib/components/AuthorAutocomplete.svelte`
- Catalog author lookup and Discover author-filter query: `src/lib/layoutDetails.ts`
  (`resolveAuthorByName`), `src/lib/filterUrlCodec.ts` (`authorFilterIndexSearch`)
- Saved-layout delete confirmation: `src/lib/components/DeleteSavedLayoutModal.svelte`
- Editable mapping panels: `src/lib/components/CreatorMagicMappingsPanel.svelte`,
  `src/lib/components/CreatorAdaptiveMappingsPanel.svelte`
- Route: `src/routes/create/+page.svelte`, `src/routes/create/+page.ts`
- App-bar Discover and Create links and document-scroll shell: `src/routes/+layout.svelte`
- Reused practice session and keyboard workspace: `src/lib/components/LayoutTypingPractice.svelte`,
  `src/lib/components/LayoutKeyboardWorkspace.svelte`
- Show-page preview and shared creator tabs: `src/lib/components/LayoutExpandedView.svelte`
  (`localPreview`, `hideSummary`, `compactPractice`, optional Edit keyboard snippets)
- Preview letter-row and gap-key fill: `src/lib/layoutDisplay.ts` (`fillPreviewKeyboardRows`)
- Shared keyboard option presentation and swap-path measurement:
  `src/lib/layoutKeyboardFeedback.ts` (`LayoutKeyboardPresentation`),
  `src/lib/layoutKeyboardSwapPathLayer.ts`
- Pageview sanitization: `src/lib/goatcounter.ts`
- Unit coverage: `tests/layoutCreator.test.ts`, `tests/layoutCreatorMappings.test.ts`,
  `tests/layoutCreatorUrl.test.ts`, `tests/layoutCreatorStorage.test.ts`,
  `tests/layoutDisplay.test.ts`, `tests/goatcounter.test.ts`
- Browser coverage: `tests/e2e/layout-creator.e2e.ts`

## Invariants

- The app remains client-only (`ssr = false`). `/create` is prerendered alongside the index.
- Discover and Create are links, not modals, and stay available from every route.
- Creator tabs use the shared `Tabs` primitive with automatic Arrow/Home/End activation and a
  labelled tab/tabpanel pair. `+ New layout` is a button beside the tablist, not a tab, and only
  appears when a saved layout exists.
- GoatCounter counts `/create` as a coarse page class titled `Layout creator`. Do not send draft
  names, author names, key maps, lesson text, or WPM.
- A copied `/create` query restores the draft. Create and `+ New layout` open Edit
  (`/create?edit=1`). A bare `/create` link opens Preview of the default canvas. Saved-layout tabs
  come from local storage; `id` in the query selects one when it exists.
