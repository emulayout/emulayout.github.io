# Layout detail page

AI implementation context for the dedicated page that replaces the former expanded-layout modal.

## Product model

- `/` is the layout index. Catalog cards link to `/layouts/[name]` for expanded layout details.
- A catalog card's keyboard visualization is a prominent detail link. A clean click or keyboard
  activation opens the detail page, while dragging across its characters preserves native text
  selection and does not navigate. The separate action-toolbar link remains available.
- The detail route replaces the index content while preserving the shared app bar, including
  Discover (current), Create, Quick Find, Compare, help hints, theme controls, and the home link.
- Opening Compare from a detail page seeds that layout as the right-hand compare-to side and leaves
  the left picker free for choosing the comparison layout. Reset and hotkey-reset behavior is
  unchanged.
- Layout names are route parameters. Links must use SvelteKit's route-aware `resolve` helper so
  names are encoded correctly.
- Detail URLs are canonical layout paths whose query state is a valid `tab=practice`, `tab=test`,
  `tab=feel`, or `tab=stats` value plus an optional Typing-practice `text` lesson. Index filters,
  selections, and display state are reset while the detail route is active and cannot rewrite its
  URL. Missing, invalid, or mixed tab state is canonicalized to one valid `tab` value.
- When a detail page is opened from the catalog, the index URL — including filter, selection, and
  display query — remains the previous history entry. Browser Back returns to that exact catalog
  view. Detail-to-detail navigations such as Quick Find push additional entries, so Back steps
  through each visited layout before restoring the catalog. Direct visits have no catalog history
  entry; Back leaves the app, and Discover still goes to `/`.
- Direct links are first-class. An unknown name renders an in-page not-found state with a route back
  to the index rather than leaving a blank page.
- The show page has four accessible sections: `Typing practice`, `Layout test area`, `Layout feel`,
  and `Stats`. The `tab` query parameter is their source of truth, including for direct links and
  reloads; missing or invalid values default to Typing practice. The layout creator reuses the same
  expanded view and `tab` query for Edit and Preview without Stats or the cminibrowser link; see
  [`layout-creator.md`](./layout-creator.md).

## Data loading

GitHub Pages serves generated static files and has no runtime API. The index continues to load
`all-layouts.json` plus analyzer-wide maps when filtering, sorting, or card presentation requires
them. A detail route instead loads exactly one generated file from `static/layout-details/`.

Each versioned detail file contains one compact layout tuple, its resolved author and like count,
its Magic/Adaptive input-behavior source, corpus-keyed compact cmini and Mana2 stats, and compact
Cyanophage stats. Filenames are the canonical layout name encoded as UTF-8 hex, avoiding filesystem
and URL ambiguity for punctuation and international names. `bin/layout-details.js` generates the
files from the existing aggregate artifacts, writes only byte-changed files, and removes stale
generated JSON files. It also publishes `static/layout-names.json`.

The persisted corpus preference is global shell state. Both the index toolbar and detail-page Stats
options expose the same selector, and the shared layout applies its value on every route. Detail and
Quick Find views resolve the matching cmini and Mana2 entry from their per-layout payload.
Consequently, changing routes or reloading a detail URL preserves the chosen corpus without
downloading an analyzer-wide stats map. Cyanophage continues to ignore the corpus preference.

Quick Find uses the in-memory aggregate catalog (layouts, authors, likes, input
profiles, and any already-loaded analyzer maps) for name search and card previews
whenever that catalog is already hydrated — typically on the index, or after
Compare has loaded aggregates from a detail visit. Those previews update instantly as
the highlight moves. On a fresh detail-page load it searches `layout-names.json` and
loads the highlighted layout's detail file only after a short debounce, so typing or
arrowing through results does not fire a request per step. Choosing a result (Enter,
list click, or a preview details link) opens that layout's show page and dismisses the
modal; with Cmd/Ctrl held, the show page opens in a new tab and the modal stays open. Compare still needs the full catalog and analyzer-wide maps, so opening it from a
direct detail visit loads those aggregates on demand. This keeps ordinary direct visits
small without weakening app-bar functionality.

## Detail content and state

- A detail-rich layout card and its external links persist in the left column outside the tab
  panels. The card includes metadata, the layout display, likes, and compact analyzer stats, but
  deliberately omits selection, author-filter, metric-filter/sort, and action-toolbar buttons.
- The Stats section groups its analyzer visibility checkboxes under `Stats options`, with a compact
  corpus selector in the section heading row. The corpus selector changes cmini and Mana2 values
  throughout the detail page and shares its persisted selection with the index toolbar. Cyanophage
  values are unchanged.
- The layout display uses the same full-width keyboard row as a catalog card, keeping its Magic,
  Adaptive, and Repeat indicators aligned in the same right-hand rail.
- The summary card includes its own analyzer selector directly below finger usage. It switches the
  card among cmini, Cyanophage, and Mana2 without changing the index analyzer preference or the
  analyzer visibility controls in the detail page's `Stats` section. Its cmini and Mana2 values use
  the globally selected corpus, including after a direct visit or reload. When the summary card has
  enough inline space, its Highlights metric grid and finger-usage chart share one row; narrower
  summaries stack them, and catalog cards retain their existing presentation.
- Ordinary external links below the card open the canonical layout by name in cminibrowser, open it
  in Cyanophage when compatible, and open a custom typing lesson on Colemak Camp. These are semantic
  links rather than button-driven menus.
- Repeat behavior stays enabled on the detail page and has no detail-page toggle. The summary card
  keeps the catalog-style anglemod action as its only card action. Anglemod changes update the card,
  typing emulator, and generated Cyanophage and Colemak Camp links; the canonical-name cminibrowser
  link remains unchanged.
- The `Typing practice`, `Layout test area`, `Layout feel`, and `Stats` tabs sit at the top of the
  right column and control only that main content. The persistent layout card is not part of any tab
  panel. Selecting a tab replaces the current detail history entry with its canonical query URL, so
  browser Back still returns to the previous page rather than earlier tabs. When help hints are on, the Layout
  feel tab shows a decorative `?` mark and a short title tip explaining remapped familiar-keyboard
  practice, without adding a second focusable control inside the tablist.
- `Typing practice` is the first and default tab. It presents ten random English 1k words or a
  URL-authored custom lesson, a single-line layout-aware field, progress and elapsed time, completion
  Accuracy/WPM, and the board-aware keyboard workspace. Typed characters color the current target
  green or red. Exact non-final words advance on Space; the final word completes immediately without
  Space. The field uses the same input resolver, anglemod state, disabled mappings, and
  uninterrupted-history rules as the Layout test area. See
  [`typing-practice.md`](./typing-practice.md) for its state model, vocabulary provenance, metrics,
  prompt guidance, and extension boundaries.
- `Layout feel` sits between Layout test area and Stats. It reuses Typing practice’s lesson flow,
  prompt/input feedback, metrics, keyboard workspace, and display options. Lesson `text` and
  `special` query state is shared with Typing practice and preserved across detail tabs. The live
  source word list is also shared. Switching away from an in-progress Practice or Feel test keeps
  the words that have not been entered correctly, appends new random words to restore a ten-word
  lesson, and clears the timer, input, and `0/10` progress. Each source
  word is planned on the page layout first — including
  enabled Magic and Adaptive shortcuts — then each planned keystroke is remapped to the user’s
  configured input-layout label on that physical slot. Example: with input layout QWERTY on
  Colemak-DH and no contextual shortcuts, `hello` becomes `mkuu;`. With Magic/Adaptive enabled, the
  remapped prompt includes those trigger/base keystrokes instead of spelling every emitted letter.
  The remapped prompt is the typing target (identity input, no live target resolve); the original
  English words sit above it in a quieter secondary line — the active word plus a more muted preview
  of the next word — and advance with the lesson. The lesson settings control sits on the remapped
  prompt row, not the source-word line. That source row keeps its height when the lesson
  finishes so the remapped prompt does not jump. As each remapped keystroke is entered correctly,
  the corresponding source letters turn primary color. Magic and Adaptive underlines mark the
  remapped keystroke spans; next-key highlights still land on the practiced layout’s keycaps. When
  Magic is preferred and emits a single character, typing the remapped literal letter for that emit
  is also accepted, while the prompt and next-key highlight keep showing the Magic trigger. Adaptive
  stays preferred-only because the swapped key is the true key at that moment. A wrong keypress
  briefly flashes the expected remapped letter red, including when Ignore wrong key presses discards
  the input. Ignored wrong inserts still count as incorrect attempts for accuracy. A default-on
  Ignore wrong key presses option discards keystrokes that would introduce an
  input error, and also blocks backspace, so neither appears in the feel field; it persists with the
  other display options. Turning Ignore wrong key presses on while the field already has an error
  trims input back to the last correct prefix. With Simulate thumb keys on, planned thumb keystrokes
  other than space appear as `_` in the remapped prompt; Space inserts that marker, and the literal
  remapped letter for that thumb slot does not count. With Simulate thumb keys off, a practiced-layout key that has no physical input-layout mapping
  soft-locks in Feel and is excluded from random lessons on both Typing practice and Feel: the
  remapped prompt still shows its label, but typing that letter does not satisfy it. Those keycaps
  show a red slash with a hover hint; thumb keys also suggest Simulate thumb keys or assigning the
  thumb in Input layout. Input-layout, anglemod, and Simulate thumb keys changes re-plan an
  untouched lesson only; an in-progress lesson keeps its current remapping until restart.
- Typing practice exposes the shared input-layout configuration control. Its modal can seed the
  editable physical key map from any known layout, choose staggered or ortho presentation, and
  persist a fully customized map. Opening the base-layout picker from a cold detail visit lazily
  loads the aggregate catalog because the picker requires all known layouts. The compiler and
  control are reusable. The detail Layout test area and index-card emulators use the same persisted
  input layout and structured slot mapping for free typing. See
  [`keyboard-input-configuration.md`](./keyboard-input-configuration.md).
- `Layout test area` keeps its full-width, free-form keyboard emulator first. The shared keyboard
  workspace follows it, using the same structure as Typing practice: the key group and its
  responsive options grid form one centered cluster, while Magic or Adaptive mappings occupy a
  capped right-hand column when space permits and expand beneath the keyboard when it does not. The
  workspace has no outer card treatment, retains full-size keys until its actual board geometry no
  longer fits, and exposes the shared Input layout control above the keys. Its options include the
  shared home-key coloring and special-key visibility treatments in addition to its free-typing
  contextual previews. Home-key coloring defaults on, and every option in this workspace persists
  across layouts and reloads in a dedicated versioned local-storage document.
  For a recognized Magic layout, that styled keyboard defaults to a dynamic preview: each known
  trigger uses the card's Magic symbol until the current uninterrupted test-area history gives it
  an output, then shows that next output on an accent-colored keycap. A persisted switch restores the
  literal trigger characters and ordinary key styling. An unmapped conventional `*` still gets the
  neutral Magic symbol but cannot show a prospective output.
  Adaptive layouts use the same switch. After a trigger arms one or more enabled swaps, both
  affected keycaps replace their base letters with their swapped outputs and use the active accent
  background until the uninterrupted context changes or resets. A separate, default-off
  `Show swap paths` switch draws accent connectors between each currently active pair. Paths can be shown
  independently of the label preview and disappear with the same history and mapping resets.
  Ortho and mini boards use aligned split geometry, retaining empty physical key slots so the center
  seam stays straight when a row is missing keys; stagger and angle boards use ANSI row offsets.
  Thumb keys remain on their assigned left or right half in either geometry, even when both
  hands emit the same character. Ortho thumbs align
  below their hand's index-finger column; angle and stagger thumbs align between their hand's
  adjacent bottom-row index positions. Both follow the card's anglemod state.
- `Stats` contains analyzer visibility controls, analyzer-specific metrics, and shared comparison
  tables in the right column.
- The card is the page's visible layout-name heading; the redundant detail-page heading is omitted.
  The document title and the detail article's accessible name use the exact canonical layout name.
- The compact summary card omits selection, the recursive detail link, and the layout test area. It
  retains its local analyzer-switchable stats plus layout-local and external-link actions.
- On first use, analyzer checkboxes select every analyzer included in the detail file. Later changes,
  including an explicit all-unchecked state, persist across layouts, navigation, and reloads. If a
  selected analyzer result is absent, the page may fall back to the analyzer-wide static map.
- Magic and Adaptive mapping controls appear in the active typing workspace. Their shared
  disabled-mapping state is page-session-only and resets on navigation or reload, matching the
  previous expanded-view model.
- The styled keyboard's prospective Magic and Adaptive output uses the emulator's exact history and
  current disabled mappings. A no-op Magic trigger has no active background, while each armed
  Adaptive swap colors both affected keys and optionally connects them. Resetting emulator history
  immediately restores the base keyboard state and removes every connector.
- Detail pages use normal document scrolling at every viewport width. The summary card and active
  detail panel all move together with the page.

## Code map

- Index catalog and initial analyzer loading: `src/lib/layoutIndexLoader.ts`, `src/routes/+page.ts`
- Shared app bar and on-demand Compare catalog loading: `src/routes/+layout.svelte`,
  `src/lib/layoutsCatalog.svelte.ts`
- Dynamic route and layout-name resolution: `src/routes/layouts/[name]/+page.ts`,
  `src/routes/layouts/[name]/+page.svelte`
- Detail tab URL parsing and canonical URLs: `src/lib/layoutDetailTabs.ts`
- Detail wire format, decoding, catalog-backed previews, URLs, and cache:
  `src/lib/layoutDetails.ts`, `src/lib/layoutDetailsStore.svelte.ts`
- Generated detail files and name index: `bin/layout-details.js`
- Quick Find name search, catalog reuse, and debounced detail loading:
  `src/lib/components/QuickFindModal.svelte`, `src/lib/layoutsCatalog.svelte.ts`
- Expanded layout content, external links, corpus selector, and analyzer controls:
  `src/lib/components/LayoutExpandedView.svelte` (`localPreview`, `hideSummary`, `compactPractice`,
  and Edit keyboard snippets for the creator),
  `src/lib/cminibrowser.ts`,
  `src/lib/components/CorpusTabs.svelte`
- Typing-practice session, rendering, and layout-aware input: `src/lib/typingPractice.ts`,
  `src/lib/typingPracticeLesson.ts`, `src/lib/typingPracticeLesson.svelte.ts`,
  `src/lib/components/LayoutTypingPractice.svelte`, `src/lib/components/LayoutTestArea.svelte`
- Layout-feel session UI and physical-key remapping: `src/lib/components/LayoutFeel.svelte`,
  `src/lib/layoutFeel.ts`
- Shared input-layout model, persisted store, modal, and editor: `src/lib/keyboardInputConfig.ts`,
  `src/lib/keyboardInputStore.svelte.ts`,
  `src/lib/components/KeyboardInputConfigControl.svelte`,
  `src/lib/components/KeyboardInputConfigModal.svelte`,
  `src/lib/components/KeyboardInputEditor.svelte`
- Persisted corpus and detail-analyzer preferences: `src/lib/uiPrefs.svelte.ts`,
  `src/lib/layoutDetailStatsPrefs.ts`
- Persisted typing-workspace display preferences: `src/lib/typingPracticePrefs.ts`,
  `src/lib/layoutTestAreaPrefs.ts`
- Shared responsive keyboard workspace and board-aware preview:
  `src/lib/components/LayoutKeyboardWorkspace.svelte`,
  `src/lib/components/LayoutKeyboardPreview.svelte`
- Detail section URL state, semantics, and keyboard navigation: `src/lib/layoutDetailTabs.ts`,
  `src/lib/components/Tabs.svelte`
- Catalog/summary card variants and detail URL: `src/lib/components/LayoutCard.svelte`
- Semantic detail link in the action toolbar: `src/lib/components/LayoutCardActions.svelte`
- Route browser coverage: `tests/e2e/layout-detail*.e2e.ts`, split across navigation, typing
  practice, Layout feel, input-layout configuration, keyboard previews, and Quick Find.

## Invariants

- The app remains client-only (`ssr = false`). The home page is prerendered to `index.html`, and the
  static adapter emits `404.html` so GitHub Pages can bootstrap direct client-side route requests.
- A direct detail link loads one generated layout-detail file and does not fetch the aggregate
  catalog unless an aggregate-dependent feature such as Compare or the input-layout base picker is
  opened.
- A direct detail link resolves cmini and Mana2 stats for the persisted corpus from that detail file;
  changing or reloading routes does not silently fall back to Monkeyracer.
- The index and detail corpus selectors are two controls for one persisted preference. Changing
  either control updates the other route on navigation or reload.
- Detail analyzer visibility preserves the user's last explicit selection, including no analyzers;
  the data-driven default applies only when no valid preference has been stored.
- Quick Find does not fetch `layout-names.json` or `/layout-details/*.json` when the aggregate
  catalog is already in memory; those requests are only for cold detail-page visits.
- On cold detail-page visits, Quick Find debounces on-demand detail loads while the highlight
  moves; catalog-backed previews stay immediate.
- Navigating to a layout detail page from Quick Find (result selection or preview details
  links) dismisses the modal. Cmd/Ctrl+Enter in the search field and Cmd/Ctrl+click on a result
  open the layout's show page in a new tab and keep Quick Find open on the current page.
- Index URL state never appears in a detail URL or persists in the filter store while a detail route
  is active. Entering Discover through SPA navigation, including creator preview links, hydrates
  the filter store from that index URL. Browser Back returns to the previous history entry,
  including the index URL with its filter query, and popstate hydrates it the same way.
- Navigating between index and detail pages never hides or disables app-bar features.
- Detail routes never create a viewport-height internal vertical scroll container; the document
  owns vertical scrolling at every breakpoint.
- Typing practice is the fallback detail section when `tab` is absent or invalid. Typing practice,
  Layout test area, Layout feel, and Stats are linked tab/tabpanel pairs with automatic Arrow/Home/End
  keyboard activation; the URL follows each activation, and the persistent left card is outside every
  panel.
- A summary card cannot link recursively to its own detail page.
- Detail URLs preserve canonical layout-name casing and encoding.
- Missing layouts always provide a path back to the index.
- Unchanged generated detail payloads are not rewritten, and layouts removed from the catalog leave
  no stale generated JSON file.
