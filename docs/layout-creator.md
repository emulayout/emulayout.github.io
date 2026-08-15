# Layout creator

AI implementation context for the in-progress layout creator: a dedicated page where people
draft layouts, try them with the same practice workspace as a catalog layout, and save those
drafts in the browser.

## Product model

- The shared app bar includes **Discover** and **Create** choice-chip links to the right of the
  logo. Discover goes to `/` and stays current on layout show pages. Create goes to `/create`.
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
  saved tab. Switching tabs loads that layout's snapshot into the editor. A `+ New layout` button
  sits on the far side of the tab bar and starts a blank unsaved canvas without leaving `/create`.
  A bare `/create` link does the same.
- The New layout canvas starts as a stagger QWERTY board named `New layout`. A layout name field
  sits above Input layout. The name updates the live draft; an empty value falls back to
  `New layout`. The document title and the active tab use that name. Renaming does not regenerate
  the practice words.
- The current draft is the `/create` query string, using the same replace-state sync as the index.
  Name, base layout, keyboard type, key grid, preview, practice lesson, and Magic/Adaptive mappings
  (including incomplete rows) are written when they differ from the blank canvas. An active saved
  layout also writes `id` (a local-storage UUID). When that saved layout is unchanged, other draft
  params are omitted so the URL is `/create?id=<uuid>`. Dirty edits stay in the query alongside
  `id` so a refresh keeps them. Writes wait 300ms after the last edit, matching the index filter
  URL persist, and flush on page hide so a refresh keeps the latest keystrokes. A bare `/create`
  link starts fresh. Reloading or opening the URL restores the draft, and a known `id` restores
  that saved layout from local storage. Defaults are omitted, so an untouched unsaved canvas stays
  `/create`. Empty standard slots are omitted from `keys`; a cleared board is `keys=v1:-`. Do not
  put draft names, saved ids, or key maps into GoatCounter paths or events.
- In Edit, the typing-practice keyboard slot shows the editable key editor instead of the
  presentation preview. Base layout (optional) and keyboard type sit above that editor. Choosing a
  catalog layout seeds the key grid, keyboard type, and that layout's default Magic and Adaptive
  mappings; empty slots stay optional, so a draft may use fewer or more assigned characters than
  the base. Printable keys replace the focused slot and advance, Backspace/Delete clear, and arrows
  move among slots. Typing `@` or `*` into a slot adds that trigger to Magic mappings when it is not
  already present, and turns Magic on. `@` starts as fallback-only (otherwise → repeat previous),
  with no empty mapping row; Add mapping still adds rows. `*` uses the empty Magic section. If Magic
  is still unused and the first typed trigger is `@`, the placeholder `*` section is omitted.
  Clearing `@` or `*` from a slot does not remove its mapping.
  Keyboard type is Ortho or Staggered. Thumb keys use the same left/right
  separation as the presentation keyboard, with an empty spacebar-sized gap
  between hands, including when both thumbs emit the same character. Assigned values may repeat and stay on
  their own slots, so several keys can output the same character. Empty slots are omitted from the
  live draft. Edits update the in-memory layout immediately so Typing practice uses the current
  keys.
- Preview turns the name into a title and restores the presentation keyboard: next-key
  highlighting, home-key coloring, and the catalog mapping panel. The key editor, base-layout and
  keyboard-type fields, special-key add buttons, and editable mapping panels are hidden until Edit
  again. The catalog mapping panel still appears when the draft has complete Magic or Adaptive
  mappings, even if those editors were closed in Edit. The sticky bar shows **Preview** while
  editing, which opens the uneditable presentation, and **Edit** while previewing.
- While in Edit, Magic and Adaptive add buttons sit to the right of the keyboard in their
  own column, vertically centered with the board. Either or both can be on. Magic adds a `*`
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
  disable complete mappings with the same checkboxes as the catalog selectors. Each Magic section
  also has the schema fallback: nothing (`no-op` / omitted), repeat previous, or fixed text. Fixed
  text stacks under the fallback selector in the same field column. Rule and fallback rows share
  columns so the trigger and output line up; the preceding field fills the space before the trigger.
  A trigger can live on an emitting
  fallback alone. Incomplete rows stay in the draft and are omitted from the live practice profile.
- The main panel reuses Typing practice: a generated English 1k lesson, the layout-aware input,
  progress and elapsed time, and the shared keyboard workspace (input-layout control, home-key
  coloring, next-key highlighting). The prompt and input use that workspace's width. The same
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
  **Save as new layout** when a saved layout has changed; **Duplicate layout** only when a saved
  layout matches its stored snapshot. Save, update, save-as-new, and duplicate use the current
  layout name. A save is only acknowledged after local storage confirms the write. If storage is
  unavailable, the creator keeps the full draft URL and shows a recoverable error instead of
  switching to an id-only URL. Open creator tabs synchronize saved-layout changes, and writes merge
  stable ids so one tab does not discard layouts saved by another. They do not send analytics events.

## Deferred work

- Repeat mapping editors.
- Renaming and deleting saved drafts from the tab bar.

## Code map

- Default canvas, tab values, and key-editor conversion: `src/lib/layoutCreator.ts`
- Shareable `/create` query codec: `src/lib/layoutCreatorUrl.ts`
- Saved-layout local-storage document and session restore: `src/lib/layoutCreatorStorage.ts`
- Draft Magic/Adaptive mapping sources, catalog seeding, and compilation: `src/lib/layoutCreatorMappings.ts`
- Catalog layouts and supplemental mappings: `src/lib/layoutsCatalog.svelte.ts`
- Creator page chrome, live key editor, and practice workspace: `src/lib/components/LayoutCreator.svelte`
- Editable mapping panels: `src/lib/components/CreatorMagicMappingsPanel.svelte`,
  `src/lib/components/CreatorAdaptiveMappingsPanel.svelte`
- Route: `src/routes/create/+page.svelte`, `src/routes/create/+page.ts`
- App-bar Discover and Create links and document-scroll shell: `src/routes/+layout.svelte`
- Reused practice session and keyboard workspace: `src/lib/components/LayoutTypingPractice.svelte`,
  `src/lib/components/LayoutKeyboardWorkspace.svelte`
- Pageview sanitization: `src/lib/goatcounter.ts`
- Unit coverage: `tests/layoutCreator.test.ts`, `tests/layoutCreatorMappings.test.ts`,
  `tests/layoutCreatorUrl.test.ts`, `tests/layoutCreatorStorage.test.ts`,
  `tests/goatcounter.test.ts`
- Browser coverage: `tests/e2e/layout-creator.e2e.ts`

## Invariants

- The app remains client-only (`ssr = false`). `/create` is prerendered alongside the index.
- Discover and Create are links, not modals, and stay available from every route.
- Creator tabs use the shared `Tabs` primitive with automatic Arrow/Home/End activation and a
  labelled tab/tabpanel pair. `+ New layout` is a button beside the tablist, not a tab.
- GoatCounter counts `/create` as a coarse page class titled `Layout creator`. Do not send draft
  names, key maps, lesson text, or WPM.
- A copied `/create` query restores the draft. Navigating to a bare `/create` link starts a new
  canvas. Saved-layout tabs come from local storage; `id` in the query selects one when it exists.
