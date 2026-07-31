# Finger workload filter

AI implementation context for the relative finger-workload feature.

## Product model

- Finger workload is one top-level filter above `Analyzer filters`; it is not duplicated inside
  analyzer tabs.
- The filter owns one `FingerWorkloadConfig`:
  - `analyzer`: `cmini`, `cyanophage`, or `mana2`;
  - `preference`: independent `left` and `right` finger rankings.
- `Measure using` selects the only analyzer used to evaluate workload. Workload is never averaged
  or ANDed across analyzers.
- Analyzer-specific percentage/stat limits remain independent and are ANDed with workload.

## Ranking semantics

Levels are ordinal:

```text
none < lightest < light < medium < heavy
```

`none` means no constraint. For every pair of configured fingers with different levels, the
higher-ranked finger must have strictly greater usage in the selected analyzer. Equal levels do
not constrain one another. Rank distance has no meaning: `lightest < medium` and `light < medium`
are equivalent unless another finger occupies the intervening level.

A hand affects filtering only when it contains at least two distinct non-`none` levels. Active
left- and right-hand constraints are both required.

## UI behavior

- Hands are linked by default; the single `Both hands` editor mirrors changes to both hands.
- `Unlink hands` exposes independent left/right editors.
- `Relink hands` copies the left-hand preference to the right hand.
- The explanation is an optional help hint and follows the global hints toggle.
- The active chip includes the measurement source:
  `Workload (Cmini): Both M > I > R/P`.

Quick presets:

| Preset                               | Pinky    | Ring  | Middle | Index  |
| ------------------------------------ | -------- | ----- | ------ | ------ |
| Middle finger dominant               | Light    | Light | Heavy  | Medium |
| Middle finger dominant (low pinkies) | Lightest | Light | Heavy  | Medium |
| Middle/index dominant                | Light    | Light | Heavy  | Heavy  |
| Middle/index dominant (low pinkies)  | Lightest | Light | Heavy  | Heavy  |
| Index dominant                       | Lightest | Light | Medium | Heavy  |
| Low pinkies                          | Lightest | Heavy | Heavy  | Heavy  |

## Filtering and loading

- Only an active preference (two distinct levels on at least one hand) requests analyzer data or
  filters layouts.
- Filtering uses the selected analyzer's derived `LP/LR/LM/LI` and `RP/RR/RM/RI` usage values.
- Missing per-layout stats fail the workload match.
- Results wait while required analyzer data loads; a failed analyzer load blocks the active stat
  filters with the existing unavailable-state UI.

## Persistence

- Draft and debounced applied state are stored as `fingerWorkload` and
  `appliedFingerWorkload` in `ViewFilterSnapshot`.
- Shared URLs use one `fingerWorkload` entry, for example:
  `cmini=left.pinky:light|left.middle:heavy|...`.
- Legacy analyzer-keyed saved state and URLs are normalized to one config. The requested/default
  analyzer is retained when it has a configured preference; otherwise the first configured
  analyzer in catalog order is selected.

## Code map

- Domain model, presets, ranking, matching, and legacy normalization:
  `src/lib/fingerWorkload.ts`
- Standalone accordion and analyzer-filter separation:
  `src/lib/components/StatFilters.svelte`
- Workload controls, preset menu, analyzer selector, and hand linking:
  `src/lib/components/StatLimitFiltersBody.svelte`
- Store state and mutations: `src/lib/filterStore.svelte.ts`
- Snapshot and URL persistence: `src/lib/filterSnapshot.ts`, `src/lib/filterUrlCodec.ts`
- Analyzer loading and layout matching: `src/lib/statsUsage.ts`, `src/lib/layoutFiltering.ts`
- Active chip/focus behavior: `src/lib/activeFilterChips.ts`, `src/lib/activeFiltersAdjust.ts`

## Invariants

- One workload preference selects exactly one analyzer.
- Same-level fingers are unordered.
- Unconfigured fingers never participate in comparisons.
- Workload remains chainable with any absolute analyzer limits.
- Resetting workload clears rankings but preserves the currently selected measurement analyzer.
