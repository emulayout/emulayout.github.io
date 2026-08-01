# Layout detail page

AI implementation context for the dedicated page that replaces the former expanded-layout modal.

## Product model

- `/` is the layout index. Catalog cards link to `/layouts/[name]` for expanded layout details.
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

- The page title and document title use the exact canonical layout name.
- The compact summary card omits selection and the recursive detail link, along with card stats and
  the layout test area. Its layout-local and external-link actions remain available.
- Analyzer checkboxes initially select every analyzer included in the detail file. If an analyzer
  result is absent, enabling it may fall back to the analyzer-wide static map.
- Magic and Adaptive mapping controls remain above analyzer stats. Their disabled-mapping state is
  page-session-only and resets on navigation or reload, matching the previous expanded-view model.
- Desktop uses an independently scrolling detail pane below the fixed app bar. Narrow viewports use
  normal document scrolling.

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
- A summary card cannot link recursively to its own detail page.
- Detail URLs preserve canonical layout-name casing and encoding.
- Missing layouts always provide a path back to the index.
- Unchanged generated detail payloads are not rewritten, and layouts removed from the catalog leave
  no stale generated JSON file.
