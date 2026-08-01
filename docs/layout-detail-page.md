# Layout detail page

AI implementation context for the dedicated page that replaces the former expanded-layout modal.

## Product model

- `/` is the layout index. Catalog cards link to `/layouts/[name]` for expanded layout details.
- The detail route replaces the index content while preserving the shared app bar, including Quick
  Find, Compare, help hints, theme controls, and the home link.
- Layout names are route parameters. Links must use SvelteKit's route-aware `resolve` helper so
  names are encoded correctly.
- A catalog card carries the current query string into the detail URL. The `Back to layouts` link
  returns to `/` with that query string, preserving the index's shareable filter and display state.
- Direct links are first-class. An unknown name renders an in-page not-found state with a route back
  to the index rather than leaving a blank page.

## Data loading

GitHub Pages serves static files and has no per-layout API. Both routes therefore use the shared
root-layout loader and download/decode `all-layouts.json`, then select the requested layout in the
client. Authors, input behaviors, likes, and the initially required analyzer payloads follow the
same loading rules as the index.

The root layout owns this data because app-bar Quick Find and Compare must work on both routes.
Analyzer payloads remain independently lazy-loadable; selecting an analyzer on the detail page
uses `layoutStatsStore.ensureLoaded` and does not require changing the catalog payload.

## Detail content and state

- The page title and document title use the exact canonical layout name.
- The compact summary card preserves selection, author, similarity, anglemod, and external-link
  actions, but omits the detail link, card stats, and layout test area.
- Analyzer checkboxes initially select analyzers already available from route loading. Enabling a
  missing analyzer lazy-loads its complete static analyzer map.
- Magic and Adaptive mapping controls remain above analyzer stats. Their disabled-mapping state is
  page-session-only and resets on navigation or reload, matching the previous expanded-view model.
- Desktop uses an independently scrolling detail pane below the fixed app bar. Narrow viewports use
  normal document scrolling.

## Code map

- Shared catalog and initial analyzer loading: `src/routes/+layout.ts`
- Shared app bar, Quick Find, Compare, and catalog hydration: `src/routes/+layout.svelte`
- Dynamic route and layout-name resolution: `src/routes/layouts/[name]/+page.ts`,
  `src/routes/layouts/[name]/+page.svelte`
- Expanded layout content and analyzer controls: `src/lib/components/LayoutExpandedView.svelte`
- Catalog/summary card variants and detail URL: `src/lib/components/LayoutCard.svelte`
- Semantic detail link in the action toolbar: `src/lib/components/LayoutCardActions.svelte`
- Route browser coverage: `tests/e2e/layout-detail.e2e.ts`

## Invariants

- The app remains client-only (`ssr = false`). The home page is prerendered to `index.html`, and the
  static adapter emits `404.html` so GitHub Pages can bootstrap direct client-side route requests.
- A direct detail link loads the complete layout catalog; no code assumes an individual-layout
  endpoint exists.
- Navigating between index and detail pages never hides or disables app-bar features.
- A summary card cannot link recursively to its own detail page.
- Detail URLs preserve canonical layout-name casing and encoding.
- Missing layouts always provide a path back to the index.
