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
  draft only; nothing is written to local storage yet.
- The typing-practice keyboard slot shows the editable key editor instead of the presentation
  preview. Base layout (optional) and keyboard type sit above that editor. Choosing a catalog
  layout seeds the key grid and keyboard type; empty slots stay optional, so a draft may use fewer
  or more assigned characters than the base. Printable keys replace the focused slot and advance,
  Backspace/Delete clear, and arrows move among slots. Keyboard type is Ortho or Staggered.
  Assigned values may repeat and stay on their own slots, so several keys can output the same
  character. Empty slots are omitted from the live draft. Edits update the in-memory layout
  immediately so Typing practice uses the current keys.
- Magic key and Adaptive key add buttons sit to the right of the keyboard in the same centered
  cluster typing practice uses for mappings. Either or both can be on. Magic adds a `*` trigger
  (or keeps one already on the board); Adaptive sets the draft's adaptive-swap flag. Clicking an
  active button removes that feature. Mapping editors for those keys are still deferred.
- A later lock control will sit across from Input layout and swap the editable board for the
  presentation-only preview (next-key highlighting, home-key coloring, and the rest of the
  practice keyboard chrome). Until that exists, the board stays editable.
- The main panel reuses Typing practice: a generated English 1k lesson, the layout-aware input,
  progress and elapsed time, and the shared keyboard workspace (input-layout control, home-key
  coloring, next-key highlighting). Magic and Adaptive mapping controls appear when the draft has
  those features, using the same workspace as the detail page.
- Creator visits use document scrolling at every viewport width, matching layout detail pages.
- Direct `/create` links are first-class. The route is prerendered so GitHub Pages can serve it
  without relying on the SPA fallback.

## Deferred work

- A lock control that switches the create keyboard between the editable editor and the
  presentation preview.
- Persist drafts in a versioned local-storage document and restore them as extra view tabs.
- Board, Magic, Adaptive, and Repeat mapping editors beyond adding the keys themselves.
- Naming, duplicating, and deleting saved drafts.
- Shareable creator URLs. Do not put draft names or key maps into GoatCounter paths or events.

## Code map

- Default canvas, tab values, and key-editor conversion: `src/lib/layoutCreator.ts`
- Creator page chrome, live key editor, and practice workspace: `src/lib/components/LayoutCreator.svelte`
- Route: `src/routes/create/+page.svelte`, `src/routes/create/+page.ts`
- App-bar Create layout control and document-scroll shell: `src/routes/+layout.svelte`
- Reused practice session and keyboard workspace: `src/lib/components/LayoutTypingPractice.svelte`,
  `src/lib/components/LayoutKeyboardWorkspace.svelte`
- Pageview sanitization: `src/lib/goatcounter.ts`
- Unit coverage: `tests/layoutCreator.test.ts`, `tests/goatcounter.test.ts`
- Browser coverage: `tests/e2e/layout-creator.e2e.ts`

## Invariants

- The app remains client-only (`ssr = false`). `/create` is prerendered alongside the index.
- The Create layout control is a link, not a modal, and stays available from every route.
- Creator tabs use the shared `Tabs` primitive with automatic Arrow/Home/End activation and a
  labelled tab/tabpanel pair.
- GoatCounter counts `/create` as a coarse page class titled `Layout creator`. Do not send draft
  names, key maps, lesson text, or WPM.
- Until persistence exists, leaving `/create` discards the in-memory draft.
