# Analytics

AI implementation context for privacy-preserving usage analytics via GoatCounter.

The goal is to learn which product surfaces people actually use so effort can go to the right
features. It is not user research, not a performance profiler, and not a keystroke or layout
popularity study.

## Product model

- GoatCounter is the only analytics vendor. Do not add a second tracker, tag manager, or advertising
  pixel.
- Metrics answer “which features are used?”, not “who is this person?” and not “what did they type?”
- Pageviews count index vs show vs show-tab visits. Events count feature interactions.
- GoatCounter event names are the metric. There are no custom dimensions or property bags. Keep the
  name set small and stable.
- GoatCounter sessions dedupe the same path or event name by default. Treat events as “used this
  feature in this visit,” not click volume. Do not set `no_session` unless a future decision
  explicitly wants every repeat click.

## Privacy invariants

These are product decisions. Preserve them unless a human explicitly revisits them.

Send only:

- Coarse page classes (`/`, `/layouts`, `/layouts?tab=test`, `/layouts?tab=feel`,
  `/layouts?tab=stats`).
- Fixed titles `Layouts index` and `Layout show` — never `document.title`, which includes layout
  names on show pages.
- Cross-origin referrers only. Same-origin referrers (including a show URL with `text=` after the
  home-link full reload) are dropped.
- Feature identifiers for controls the user touched (`filter-name`, `sort-sfb`, `compare`,
  `practice-setting-highlight-next-key`, …).

Never send:

- Layout names, author names, or author IDs.
- Filter or sort _values_ (thresholds, operators as data, selected layouts, typed name queries,
  workload rankings, similarity percents).
- Typing-practice lesson text, WPM, accuracy, timings, or per-keystroke data.
- Configured input-layout names or key maps.
- Saved-view names, share-URL payloads, or clipboard contents.
- Free-text of any kind.

Also:

- Do not reconstruct a user journey by encoding several facts into one event name
  (`practice-complete-with-highlight-next-key-on-lela`). GoatCounter cannot join events into a
  funnel without that trick, and the trick is how personal or high-cardinality data sneaks in.
- Do not snapshot “settings that happened to be on” when a lesson completes. Defaults would look
  wildly popular even when nobody chose them. Completing a lesson is not choosing those settings.
- URL hydrate, popstate restore, saved-view apply, shared-view apply, and bulk clears are not
  interactions. Only public UI setters / explicit open / complete handlers may track.
- Local development and localhost must not send counts. `import.meta.env.DEV` and loopback hosts are
  skipped in `src/lib/goatcounter.ts` before `count.js` is called. GoatCounter also filters local
  addresses unless `allow_local` is set; do not enable `allow_local` in the shipped snippet.
- Do not call `goatcounter.count()` directly. `count.js` always attaches `q=location.search`, which
  would leak index filter query strings and practice `text=`. Build the hit with `goatcounter.url()`,
  delete `q`, then `sendBeacon`.

## Pageviews

The site is a client-only SPA. `count.js` is loaded from `src/app.html` with `no_onload: true` so
the first paint does not double-count. The root layout calls `trackGoatCounterPageview` from
`afterNavigate`, including the initial load. SvelteKit's SPA `enter` navigation provides
`from: { url: null }` rather than `from: null`; treat a missing `url` as no previous page.

`goatcounterPageviewPath` sanitizes every pageview:

| Real URL                                                   | Counted path         |
| ---------------------------------------------------------- | -------------------- |
| `/` plus any index filter, display, view, or share query   | `/`                  |
| `/layouts/<name>` or `?tab=practice` plus optional `text=` | `/layouts`           |
| `/layouts/<name>?tab=test`                                 | `/layouts?tab=test`  |
| `/layouts/<name>?tab=feel`                                 | `/layouts?tab=feel`  |
| `/layouts/<name>?tab=stats`                                | `/layouts?tab=stats` |

Index filter query churn and show-page `text=` must never become distinct pages. Individual layout
names are omitted so index vs show vs tab totals stay readable. Do not put layout names back into
pageview paths without an explicit product decision; that list would bury the visit totals this
instrumentation exists to provide.

Pageview titles are `Layouts index` or `Layout show` according to that sanitized path, not the
document title.

Navigations that sanitize to the same path are skipped (index filter tweaks, detail-to-detail
layout changes on the same tab, practice-text edits).

## Events

Event names must not start with `/`. Build them with the helpers in `src/lib/goatcounter.ts` when a
helper exists.

### Shell

| Event        | When                                  |
| ------------ | ------------------------------------- |
| `quick-find` | Quick Find opens (button or ⌘/Ctrl+K) |
| `compare`    | Compare modal opens                   |

### Filters and sort

Tracked from `filterStore` public setters that represent a person changing a control. Hydrate and
`#restoreViewFilters` assign fields directly and must stay that way so restores stay silent.

| Event                                                                                                                                                     | Control                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `filter-name`, `filter-author`                                                                                                                            | Name and author filters                                                                |
| `filter-similarity`                                                                                                                                       | Similarity reference, percent, scoring, or mirror options                              |
| `filter-workload`                                                                                                                                         | Finger-workload preference, preset, analyzer, or relink                                |
| `filter-keys-and`, `filter-keys-or`, `filter-keys-exclude`                                                                                                | Key-position modes                                                                     |
| `filter-thumb-keys`, `filter-magic-keys`, `filter-repeat-keys`, `filter-adaptive-swaps`, `filter-character-set`, `filter-board-type`, `filter-unfinished` | Keyboard filters                                                                       |
| `filter-stat-<key>`                                                                                                                                       | One analyzer stat-limit field or likes (`filter-stat-sfb`, `filter-stat-cyano-sfb`, …) |
| `sort-<sortBy>`                                                                                                                                           | Sort field only (`sort-date`, `sort-sfb`, `sort-cyano-effort`, …), not asc/desc        |

Stat and sort identifiers are public catalog metric names, not user data. Do not append the typed
threshold or selected author.

### Typing practice

| Event                       | When                                                                            |
| --------------------------- | ------------------------------------------------------------------------------- |
| `practice-complete`         | A lesson actually finishes                                                      |
| `practice-setting-<option>` | A practice display toggle is flipped (`practice-setting-highlight-next-key`, …) |

Visiting the Typing practice tab is already a pageview (`/layouts`). `practice-complete` is the
signal that someone used the feature rather than glanced at the tab.

Practice settings are counted at toggle time in `uiPrefs.setTypingPracticeDisplayOption`, not as a
bundle on complete. Do not add WPM, accuracy, custom-text flags that embed the text, or input-layout
identity.

### Layout feel

| Event           | When                   |
| --------------- | ---------------------- |
| `feel-complete` | A feel lesson finishes |

Layout feel currently reuses practice display options, so toggling those still emits
`practice-setting-*` (including `practice-setting-ignore-wrong-key-presses`). Visiting Layout feel
is a distinct pageview (`/layouts?tab=feel`).

## Adding a metric

1. Confirm it is a feature-use question, not a value or identity question.
2. Reuse an existing event name when it is the same control. Prefer coarsening over minting a near
   duplicate.
3. Put the call at the user-gesture site (public setter, open handler, lesson complete). Do not
   watch derived state with `$effect` just to fire analytics.
4. Keep names in `kebab-case` with a stable prefix (`filter-`, `sort-`, `practice-setting-`).
5. Update this document and `tests/goatcounter.test.ts` when paths or name builders change.

## Code map

- Snippet and `no_onload`: `src/app.html`
- Transport, local/dev guard, path/title/referrer sanitization, `q` stripping, event-name helpers:
  `src/lib/goatcounter.ts`
- SPA pageviews: `src/routes/+layout.svelte` (`afterNavigate`)
- Quick Find / Compare opens: `src/routes/+layout.svelte`
- Filter and sort interactions: `src/lib/filterStore.svelte.ts` (`#trackFilter`, `#trackSort`)
- Practice display toggles: `src/lib/uiPrefs.svelte.ts`
- Practice complete: `src/lib/components/LayoutTypingPractice.svelte`
- Feel complete: `src/lib/components/LayoutFeel.svelte`
- Unit coverage: `tests/goatcounter.test.ts`

## Invariants

- Analytics code may fail closed. If `count.js` is late or absent, skip the count; do not block UI.
- Event names are identifiers, never interpolated user strings.
- Hits must not include `q`, layout-name titles, or same-origin referrers.
- Show-page pageviews stay on `/layouts` plus an optional non-default `tab`.
- Index pageviews stay on `/` regardless of filter or share query state.
- Restoring state from the URL or a saved/shared view must not look like the user operated each
  restored filter.
- Typing-practice keystroke analytics described as a possible future in
  `docs/typing-practice.md` are out of scope here and would need a separate, explicit privacy
  review before any implementation.
