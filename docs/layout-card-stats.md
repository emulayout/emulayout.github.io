# Layout-card stats views

AI implementation context for the Highlights and Detailed statistics shown on layout cards.

## Product model

- `Stats` is a two-option display control in the results toolbar:
  - `Highlights` is the compact default;
  - `Detailed` restores the legacy preformatted-text statistics.
- The selection applies to every layout card, including the card preview in Quick Find.
- The selection is a presentation preference, not a filter or analyzer setting. Changing it must not
  alter the active analyzer, sort, filters, or result set.
- Analyzer choice normally comes from the results toolbar. The detail-page summary card instead owns
  a local analyzer selector below finger usage so readers can inspect each analyzer without changing
  the index's analyzer preference.
- The preference is stored as `layoutCardStatsDisplay`; any value other than `detailed` resolves to
  `focused`/Highlights.
- Highlights always renders visual finger usage. Detailed always renders finger usage as part of the
  formatted text block. There is no independent visual/text finger-usage preference.
- Card and virtual-row heights depend on the selected stats view and active analyzer. Keep the
  dimension helpers synchronized with rendered content whenever either presentation changes.

## Highlights content

Highlights uses a six-cell, two-row metric grid followed by visual finger-usage data. The five base
cells are analyzer-specific versions of:

```text
SFB | SFS | Roll in
Redirect | Alt | dynamic sort metric
```

The final cell is intentionally reserved. When the active sort metric is not already one of the
five base metrics, the final cell displays that metric and its value. Leave it empty when no extra
sort metric is needed.

The injected sort metric is resolved from the analyzer that owns the sort, even when that analyzer
is not the analyzer currently displayed on the card. A cross-analyzer metric uses its source
analyzer's accent color so its provenance is visible. Do not relabel or recolor it as though it
belonged to the displayed analyzer.

## Normal-card interactions

Highlights metric cells have separate filter and sort targets:

| Action                    | Result                                                                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Click the cell body       | Open the matching analyzer/stat filter, focus its value field, and scroll it as near as possible to the center of the filter panel. Do not change its current value. |
| Shift-click the cell body | Set the filter from the card's value, choose the inclusive "this or better" operator, then focus and center the field.                                               |
| Click the sort control    | Sort by the metric. An unsorted metric starts in its preferred direction; the currently sorted metric offers the opposite direction as a toggle.                     |

`This or better` follows the metric's preferred sort direction:

- metrics where lower is preferred, such as SFB, set `Less than (or eq)` / `≤`;
- metrics where higher is preferred, such as Roll in, set `Greater than (or eq)` / `≥`.

The sort control is a thin, full-height target on the right edge of the cell and appears on hover or
keyboard focus. Its click must not also trigger the cell's filter action.

The visual finger-usage bars are filter targets too. Clicking a bar opens and focuses that finger's
usage limit for the analyzer shown on the card without changing its current value. Shift-clicking
sets the limit to the bar's displayed percentage with inclusive `≤` semantics, then opens and
focuses the field. Finger-distance bars are informational and do not target usage filters.

Filtering and sorting highlights are analyzer-aware. The active sort direction is shown in the
cell, and analyzer tones identify active filter state and cross-analyzer provenance.

## Quick Find interactions

Quick Find follows the global `Stats` selection. It must not force Highlights when Detailed is
selected.

When Quick Find is showing Highlights:

- sort controls are omitted; the preview card cannot change sorting;
- click and Shift-click on a metric cell are equivalent;
- click and Shift-click on a finger-usage bar are equivalent;
- either action toggles the card's value as an active filter;
- applying a value uses the same inclusive `this or better` operator as normal-card Shift-click;
- clicking again clears the filter only when the same operator and value are already set;
- the hidden filter sidebar is not focused or scrolled;
- a snackbar announces whether the filter was set or cleared.

Quick Find's apply-only behavior is required because the sidebar is behind the modal shadowbox.
Do not reuse the normal click-to-focus behavior inside the modal.

When Quick Find is showing Detailed, it renders the same formatted text as regular Detailed cards;
there are no metric-cell filter or sort targets.

## Data and loading

- Highlights metrics and Detailed text are built from the same decoded and derived analyzer stats.
- Keep both representations available in `LayoutStatsBlockModel`: `cardMetrics` for Highlights and
  `lines` for Detailed.
- A sort owned by another analyzer may require that analyzer's compact stats even though its tab is
  not currently displayed. The injected final cell should appear once that source data is
  available.
- Missing or loading analyzer data uses the existing status presentation instead of partially
  constructing metric cells. In Highlights, the status presentation reserves the full stats-panel
  height so action rows remain aligned between available and unavailable cards.
- Cyanophage may additionally show finger-distance bars when that preference is enabled; Cmini and
  Mana2 show finger usage only.
- Stats corpus (Monkeyracer / Reddit) is available in the results toolbar beside Analyzer and in the
  layout-detail Stats options. Both controls edit one persisted preference. It applies only to
  cmini and Mana2 dump artifacts; Cyanophage keeps its bundled word-frequency input. Changing corpus
  reloads those dump-backed stats maps without altering analyzer, filters, or sort. Per-layout
  detail payloads carry corpus-keyed cmini and Mana2 values so direct detail visits, Quick Find, and
  Compare remain consistent after navigation or reload.

## Code map

- Display preference and persistence: `src/lib/uiPrefs.svelte.ts`
- Corpus catalog and artifact URLs: `src/lib/statsAnalyzers.ts`
- Dump-backed stats loading and corpus invalidation: `src/lib/layoutStatsLoader.ts`,
  `src/lib/layoutStatsStore.svelte.ts`
- Global corpus application and per-layout resolution: `src/routes/+layout.svelte`,
  `src/lib/layoutDetails.ts`, `bin/layout-details.js`
- Shared corpus control (native select): `src/lib/components/CorpusTabs.svelte`,
  `src/lib/components/LayoutResultsToolbar.svelte`,
  `src/lib/components/LayoutExpandedView.svelte`
- Toolbar toggle: `src/lib/components/StatsDisplayTabs.svelte`,
  `src/lib/components/LayoutResultsToolbar.svelte`, `src/lib/components/SegmentedControl.svelte`
- Analyzer models, base metrics, preferred sort directions, and dynamic sixth-cell placement:
  `src/lib/layoutStatsBlockModel.ts`
- Highlights grid, filter target, sort target, analyzer tones, and Detailed rendering:
  `src/lib/components/LayoutCardStatsPanel.svelte`
- Filter application, inclusive operator choice, cross-analyzer sort resolution, and card sizing:
  `src/lib/components/LayoutCard.svelte`
- Quick Find apply-only behavior and snackbar: `src/lib/components/QuickFindModal.svelte`
- Filter target lookup: `src/lib/statsFiltering.ts`
- Sort-field metadata and default directions: `src/lib/statsSorting.ts`
- Rendered card/stat heights: `src/lib/constants.ts`
- Dimension regression coverage: `tests/layoutCardDimensions.test.ts`

## Invariants

- Highlights has exactly six metric slots; the sixth is the dynamic sort slot.
- A sort metric already present in the base five is never duplicated in the sixth slot.
- A cross-analyzer sort metric retains its source analyzer, value formatting, and color.
- Regular click focuses a filter without overwriting it; regular Shift-click sets and focuses it.
- Opening or scrolling to a filter from a card click is one-shot: switching layout view tabs must
  not re-open or re-scroll to that filter just because it remains active.
- Finger-usage bars target the displayed analyzer's matching finger limit and always use inclusive
  `≤` when setting their value.
- Quick Find click and Shift-click both toggle the value and never focus the covered sidebar.
- Quick Find never exposes stat sorting.
- The detail-page summary analyzer selector changes only that card's analyzer.
- The index and detail corpus selectors share one persisted corpus preference.
- Filter values set from cells use inclusive `≤` or `≥` semantics according to the metric's
  preferred direction.
- Highlights owns visual finger usage; Detailed owns text finger usage.
- The mode preference changes presentation only and is shared by results and Quick Find.
