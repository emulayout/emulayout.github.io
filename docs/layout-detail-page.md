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
- Detail URLs are canonical layout paths with no index query parameters. Index filters, selections,
  and display state are reset while the detail route is active and cannot rewrite its URL.
- When a detail page was opened from the catalog, `Back to layouts` uses browser history to restore
  the untouched index URL. Direct visits fall back to `/`.
- Direct links are first-class. An unknown name renders an in-page not-found state with a route back
  to the index rather than leaving a blank page.
- The show page has two accessible sections: `Test area` and `Stats`. Test area is always the
  default when a detail page opens.

## Data loading

GitHub Pages serves generated static files and has no runtime API. The index continues to load
`all-layouts.json` plus analyzer-wide maps when filtering, sorting, or card presentation requires
them. A detail route instead loads exactly one generated file from `static/layout-details/`.

Each versioned detail file contains one compact layout tuple, its resolved author and like count,
its Magic/Adaptive input-behavior source, and all available compact cmini, Cyanophage, and Mana2
stats. Filenames are the canonical layout name encoded as UTF-8 hex, avoiding filesystem and URL
ambiguity for punctuation and international names. `bin/layout-details.js` generates the files
from the existing aggregate artifacts, writes only byte-changed files, and removes stale generated
JSON files. It also publishes `static/layout-names.json`.

Quick Find searches `layout-names.json` when the aggregate catalog is not already in memory and
loads the highlighted layout's detail file after a short debounce. Compare still needs the full
catalog and analyzer-wide maps, so opening it from a direct detail visit loads those aggregates on
demand. This keeps ordinary direct visits small without weakening app-bar functionality.

## Detail content and state

- A detail-rich layout card and its external links persist in the left column outside the tab
  panels. The card includes metadata, the layout display, likes, and compact analyzer stats, but
  deliberately omits selection, author-filter, metric-filter/sort, and action-toolbar buttons.
- The layout display uses the same full-width keyboard row as a catalog card, keeping its Magic,
  Adaptive, and Repeat indicators aligned in the same right-hand rail.
- The summary card includes its own analyzer selector directly below finger usage. It switches the
  card among cmini, Cyanophage, and Mana2 without changing the index analyzer preference or the
  analyzer visibility controls in the detail page's `Stats` section.
- Ordinary external links below the card open the layout in Cyanophage when compatible and open a
  custom typing lesson on Colemak Camp. These are semantic links rather than button-driven menus.
- A persistent option below those links disables or re-enables a Repeat key when present. The
  summary card keeps the catalog-style anglemod action as its only card action. Anglemod changes
  update the card, typing emulator, and generated external links together.
- The `Test area` and `Stats` tabs sit at the top of the right column and control only that main
  content. The persistent layout card is not part of either tab panel.
- `Test area` begins with the keyboard emulator. When Magic or Adaptive mappings exist, their
  controls share that first row on the right while the emulator occupies the larger left portion;
  narrow screens keep the emulator first and stack the mappings below it. A full-width, transparent
  keyboard-preview region follows, with its key group centered without an outer card treatment.
  For a recognized Magic layout, that styled keyboard defaults to a dynamic preview: each known
  trigger uses the card's Magic symbol until the current uninterrupted test-area history gives it
  an output, then shows that next output on an accent-colored keycap. A local switch restores the
  literal trigger characters and ordinary key styling. An unmapped conventional `*` still gets the
  neutral Magic symbol but cannot show a prospective output.
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
- Analyzer checkboxes initially select every analyzer included in the detail file. If an analyzer
  result is absent, enabling it may fall back to the analyzer-wide static map.
- Magic and Adaptive mapping controls remain above analyzer stats. Their disabled-mapping state is
  page-session-only and resets on navigation or reload, matching the previous expanded-view model.
- The styled keyboard's prospective Magic output uses the emulator's exact history and current
  disabled mappings. A no-op trigger has no active background, and resetting emulator history
  immediately returns the keycap to its neutral Magic-symbol state.
- Detail pages use normal document scrolling at every viewport width. The Back to layouts header,
  summary card, and active detail panel all move together with the page.

## Code map

- Index catalog and initial analyzer loading: `src/lib/layoutIndexLoader.ts`, `src/routes/+page.ts`
- Shared app bar and on-demand Compare catalog loading: `src/routes/+layout.svelte`,
  `src/lib/layoutsCatalog.svelte.ts`
- Dynamic route and layout-name resolution: `src/routes/layouts/[name]/+page.ts`,
  `src/routes/layouts/[name]/+page.svelte`
- Detail wire format, decoding, URLs, and cache: `src/lib/layoutDetails.ts`,
  `src/lib/layoutDetailsStore.svelte.ts`
- Generated detail files and name index: `bin/layout-details.js`
- Quick Find name search and debounced detail loading: `src/lib/components/QuickFindModal.svelte`
- Expanded layout content and analyzer controls: `src/lib/components/LayoutExpandedView.svelte`
- Large board-aware keyboard preview: `src/lib/components/LayoutKeyboardPreview.svelte`
- Detail section semantics and keyboard navigation: `src/lib/components/Tabs.svelte`
- Catalog/summary card variants and detail URL: `src/lib/components/LayoutCard.svelte`
- Semantic detail link in the action toolbar: `src/lib/components/LayoutCardActions.svelte`
- Route browser coverage: `tests/e2e/layout-detail.e2e.ts`

## Invariants

- The app remains client-only (`ssr = false`). The home page is prerendered to `index.html`, and the
  static adapter emits `404.html` so GitHub Pages can bootstrap direct client-side route requests.
- A direct detail link loads one generated layout-detail file and does not fetch the aggregate
  catalog unless an aggregate-dependent feature such as Compare is opened.
- Index URL state never appears in a detail URL or persists in the filter store while a detail route
  is active. Browser history, rather than copied query parameters, restores the index state.
- Navigating between index and detail pages never hides or disables app-bar features.
- Detail routes never create a viewport-height internal vertical scroll container; the document
  owns vertical scrolling at every breakpoint.
- Test area is the initial detail section. Test area and Stats are linked tab/tabpanel pairs with
  automatic Arrow/Home/End keyboard activation; the persistent left card is outside both panels.
- A summary card cannot link recursively to its own detail page.
- Detail URLs preserve canonical layout-name casing and encoding.
- Missing layouts always provide a path back to the index.
- Unchanged generated detail payloads are not rewritten, and layouts removed from the catalog leave
  no stale generated JSON file.
