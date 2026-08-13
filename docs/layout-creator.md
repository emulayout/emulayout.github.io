# Layout creator

AI implementation context for the in-progress layout creator: a dedicated page where people
draft layouts, try them with the same practice workspace as a catalog layout, and (later) save
those drafts in the browser.

## Product model

- The shared app bar includes a Create layout action between help hints and Compare. It is a plus
  icon that links to `/create`. While that route is active the control uses `aria-current="page"`
  and the same on-state treatment as enabled help hints.
- `/create` replaces index or detail content while preserving the rest of the app bar, including
  Quick Find, Compare, help hints, theme controls, and the home link.
- The page uses index-style view tabs, not detail-page section tabs. The first tab is always
  `New layout`. Later saved drafts will appear as additional tabs, matching how saved views join
  All layouts and Selected layouts on the index.
- The New layout canvas starts as a stagger QWERTY board named `New layout`. It is an in-memory
  draft only; nothing is written to local storage yet. A layout name field sits above Input layout
  with a lock beside it. The name updates the live draft; an empty value falls back to `New layout`.
  Renaming does not regenerate the practice words. The New layout tab label stays fixed until
  saved-draft naming exists.
- Unlocked, the typing-practice keyboard slot shows the editable key editor instead of the
  presentation preview. Base layout (optional) and keyboard type sit above that editor. Choosing a
  catalog layout seeds the key grid, keyboard type, and that layout's default Magic and Adaptive
  mappings; empty slots stay optional, so a draft may use fewer or more assigned characters than
  the base. Printable keys replace the focused slot and advance, Backspace/Delete clear, and arrows
  move among slots. Keyboard type is Ortho or Staggered. Assigned values may repeat and stay on
  their own slots, so several keys can output the same character. Empty slots are omitted from the
  live draft. Edits update the in-memory layout immediately so Typing practice uses the current
  keys.
- Locking the draft turns the name into a title and restores the presentation keyboard: next-key
  highlighting, home-key coloring, and the catalog mapping panel. The key editor, base-layout and
  keyboard-type fields, special-key add buttons, and editable mapping panels are hidden until the
  draft is unlocked again.
- While unlocked, Magic key and Adaptive key add buttons sit to the right of the keyboard in their
  own column, vertically centered with the board. Either or both can be on. Magic adds a `*`
  trigger (or keeps one already on the board); Adaptive sets the draft's adaptive-swap flag.
  Clicking an active button removes that feature.
- When a special key is on, its mapping editor appears in a separate column to the right of those
  buttons. Opening a panel does not move the icon column. Magic and Adaptive never share a panel.
  Each panel can add, edit, and delete mappings,
  add or delete labeled sections (Magic: extra triggers; Adaptive: schema groups), and temporarily
  disable complete mappings with the same checkboxes as the catalog selectors. Each Magic section
  also has the schema fallback: nothing (`no-op` / omitted), repeat previous, or fixed text. A
  trigger can live on an emitting fallback alone. Incomplete rows stay in the draft and are omitted
  from the live practice profile.
- The main panel reuses Typing practice: a generated English 1k lesson, the layout-aware input,
  progress and elapsed time, and the shared keyboard workspace (input-layout control, home-key
  coloring, next-key highlighting). Magic and Adaptive mapping controls appear when the draft has
  those features, using the same workspace as the detail page.
- Creator visits use document scrolling at every viewport width, matching layout detail pages.
- Direct `/create` links are first-class. The route is prerendered so GitHub Pages can serve it
  without relying on the SPA fallback.

## Deferred work

- Persist drafts in a versioned local-storage document and restore them as extra view tabs.
- Repeat mapping editors.
- Naming, duplicating, and deleting saved drafts.
- Shareable creator URLs. Do not put draft names or key maps into GoatCounter paths or events.

## Code map

- Default canvas, tab values, and key-editor conversion: `src/lib/layoutCreator.ts`
- Draft Magic/Adaptive mapping sources, catalog seeding, and compilation: `src/lib/layoutCreatorMappings.ts`
- Catalog layouts and supplemental mappings: `src/lib/layoutsCatalog.svelte.ts`
- Creator page chrome, live key editor, and practice workspace: `src/lib/components/LayoutCreator.svelte`
- Editable mapping panels: `src/lib/components/CreatorMagicMappingsPanel.svelte`,
  `src/lib/components/CreatorAdaptiveMappingsPanel.svelte`
- Route: `src/routes/create/+page.svelte`, `src/routes/create/+page.ts`
- App-bar Create layout control and document-scroll shell: `src/routes/+layout.svelte`
- Reused practice session and keyboard workspace: `src/lib/components/LayoutTypingPractice.svelte`,
  `src/lib/components/LayoutKeyboardWorkspace.svelte`
- Pageview sanitization: `src/lib/goatcounter.ts`
- Unit coverage: `tests/layoutCreator.test.ts`, `tests/layoutCreatorMappings.test.ts`,
  `tests/goatcounter.test.ts`
- Browser coverage: `tests/e2e/layout-creator.e2e.ts`

## Invariants

- The app remains client-only (`ssr = false`). `/create` is prerendered alongside the index.
- The Create layout control is a link, not a modal, and stays available from every route.
- Creator tabs use the shared `Tabs` primitive with automatic Arrow/Home/End activation and a
  labelled tab/tabpanel pair.
- GoatCounter counts `/create` as a coarse page class titled `Layout creator`. Do not send draft
  names, key maps, lesson text, or WPM.
- Until persistence exists, leaving `/create` discards the in-memory draft.
