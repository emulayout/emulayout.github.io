# Layout detail page

AI implementation context for the dedicated page that replaces the former expanded-layout modal.

## Product model

- `/` is the layout index. Catalog cards link to `/layouts/[name]` for expanded layout details.
- A catalog card's keyboard visualization is a prominent detail link. A clean click or keyboard
  activation opens the detail page, while dragging across its characters preserves native text
  selection and does not navigate. The separate action-toolbar link remains available.
- The detail route replaces the index content while preserving the shared app bar, including Quick
  Find, Compare, help hints, theme controls, and the home link.
- Layout names are route parameters. Links must use SvelteKit's route-aware `resolve` helper so
  names are encoded correctly.
- Detail URLs are canonical layout paths whose only query state is `tab=practice`, `tab=test`, or
  `tab=stats`. Index filters, selections, and display state are reset while the detail route is
  active and cannot rewrite its URL. Missing, invalid, or mixed query state is canonicalized to one
  valid `tab` value.
- When a detail page was opened from the catalog, `All layouts` uses browser history to restore
  the untouched index URL. Direct visits fall back to `/`.
- Direct links are first-class. An unknown name renders an in-page not-found state with a route back
  to the index rather than leaving a blank page.
- The show page has three accessible sections: `Typing practice`, `Test area`, and `Stats`. The
  `tab` query parameter is their source of truth, including for direct links and reloads; missing or
  invalid values default to Typing practice.

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
modal. Compare still needs the full catalog and analyzer-wide maps, so opening it from a
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
  the globally selected corpus, including after a direct visit or reload.
- Ordinary external links below the card open the layout in Cyanophage when compatible and open a
  custom typing lesson on Colemak Camp. These are semantic links rather than button-driven menus.
- A persistent option below those links disables or re-enables a Repeat key when present. The
  summary card keeps the catalog-style anglemod action as its only card action. Anglemod changes
  update the card, typing emulator, and generated external links together.
- The `Typing practice`, `Test area`, and `Stats` tabs sit at the top of the right column and control
  only that main content. The persistent layout card is not part of any tab panel. Selecting a tab
  replaces the current detail history entry with its canonical query URL, preserving the existing
  All layouts back-navigation behavior.
- `Typing practice` is the first and default tab. Its initial scaffold follows a lesson-like vertical
  rhythm: ten distinct words sampled from the vendored English 1k list, a large layout-aware typing
  field, word-count and elapsed-time values, and the board-aware keyboard preview at the bottom.
  Typed characters color the current target green or red. An exact word followed by Space removes
  that word, clears the input, and increments progress; the timer remains a placeholder. The field
  uses the same input resolver, anglemod state, disabled mappings, and uninterrupted-history rules
  as the Test area. See [`typing-practice.md`](./typing-practice.md) for its state model, vocabulary
  provenance, and extension boundaries.
- `Test area` begins with the keyboard emulator. When Magic or Adaptive mappings exist, their
  controls share that first row on the right while the emulator occupies the larger left portion;
  narrow screens keep the emulator first and stack the mappings below it. A full-width, transparent
  keyboard-preview region follows, with its key group centered without an outer card treatment.
  For a recognized Magic layout, that styled keyboard defaults to a dynamic preview: each known
  trigger uses the card's Magic symbol until the current uninterrupted test-area history gives it
  an output, then shows that next output on an accent-colored keycap. A local switch restores the
  literal trigger characters and ordinary key styling. An unmapped conventional `*` still gets the
  neutral Magic symbol but cannot show a prospective output.
  Adaptive layouts use the same switch. After a trigger arms one or more enabled swaps, both
  affected keycaps replace their base letters with their swapped outputs and use the active accent
  background until the uninterrupted context changes or resets. A separate, default-off `Show swap
paths` switch draws accent connectors between each currently active pair. Paths can be shown
  independently of the label preview and disappear with the same history and mapping resets.
  Ortho and mini boards use aligned split geometry, retaining empty physical key slots so the center
  seam stays straight when a row is missing keys; stagger and angle boards use ANSI row offsets.
  Thumb keys remain on their assigned left or right half in either geometry. Ortho thumbs align
  below their hand's index-finger column; angle and stagger thumbs align between their hand's
  adjacent bottom-row index positions. Both follow the card's anglemod state.
- `Stats` contains analyzer visibility controls, analyzer-specific metrics, and shared comparison
  tables in the right column.
- The card is the page's visible layout-name heading; the redundant detail-page heading is omitted.
  The document title and the detail article's accessible name use the exact canonical layout name.
- The compact summary card omits selection and the recursive detail link, along with card stats and
  the layout test area. Its layout-local and external-link actions remain available.
- On first use, analyzer checkboxes select every analyzer included in the detail file. Later changes,
  including an explicit all-unchecked state, persist across layouts, navigation, and reloads. If a
  selected analyzer result is absent, the page may fall back to the analyzer-wide static map.
- Magic and Adaptive mapping controls remain above analyzer stats. Their disabled-mapping state is
  page-session-only and resets on navigation or reload, matching the previous expanded-view model.
- The styled keyboard's prospective Magic and Adaptive output uses the emulator's exact history and
  current disabled mappings. A no-op Magic trigger has no active background, while each armed
  Adaptive swap colors both affected keys and optionally connects them. Resetting emulator history
  immediately restores the base keyboard state and removes every connector.
- Detail pages use normal document scrolling at every viewport width. The All layouts header,
  summary card, and active detail panel all move together with the page.

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
- Expanded layout content, corpus selector, and analyzer controls:
  `src/lib/components/LayoutExpandedView.svelte`, `src/lib/components/CorpusTabs.svelte`
- Typing-practice session, rendering, and layout-aware input: `src/lib/typingPractice.ts`,
  `src/lib/components/LayoutTypingPractice.svelte`, `src/lib/components/LayoutTestArea.svelte`
- Persisted corpus and detail-analyzer preferences: `src/lib/uiPrefs.svelte.ts`,
  `src/lib/layoutDetailStatsPrefs.ts`
- Large board-aware keyboard preview: `src/lib/components/LayoutKeyboardPreview.svelte`
- Detail section URL state, semantics, and keyboard navigation: `src/lib/layoutDetailTabs.ts`,
  `src/lib/components/Tabs.svelte`
- Catalog/summary card variants and detail URL: `src/lib/components/LayoutCard.svelte`
- Semantic detail link in the action toolbar: `src/lib/components/LayoutCardActions.svelte`
- Route browser coverage: `tests/e2e/layout-detail.e2e.ts`

## Invariants

- The app remains client-only (`ssr = false`). The home page is prerendered to `index.html`, and the
  static adapter emits `404.html` so GitHub Pages can bootstrap direct client-side route requests.
- A direct detail link loads one generated layout-detail file and does not fetch the aggregate
  catalog unless an aggregate-dependent feature such as Compare is opened.
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
  links) dismisses the modal.
- Index URL state never appears in a detail URL or persists in the filter store while a detail route
  is active. Browser history, rather than copied query parameters, restores the index state.
- Navigating between index and detail pages never hides or disables app-bar features.
- Detail routes never create a viewport-height internal vertical scroll container; the document
  owns vertical scrolling at every breakpoint.
- Typing practice is the fallback detail section when `tab` is absent or invalid. Typing practice,
  Test area, and Stats are linked tab/tabpanel pairs with automatic Arrow/Home/End keyboard
  activation; the URL follows each activation, and the persistent left card is outside every panel.
- A summary card cannot link recursively to its own detail page.
- Detail URLs preserve canonical layout-name casing and encoding.
- Missing layouts always provide a path back to the index.
- Unchanged generated detail payloads are not rewritten, and layouts removed from the catalog leave
  no stale generated JSON file.
