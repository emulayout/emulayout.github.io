# Emulayout

**A workbench for exploring alternative keyboard layouts.**

Search the community-maintained [AKLDB](https://akldb.org/docs) catalog, narrow it down with
position-aware filters and analyzer statistics, compare promising layouts, and type on them
directly in the browser.

[Open Emulayout](https://emulayout.github.io)

## Explore

- Search by layout name or author, or jump directly to a layout with Quick find.
- Filter by keyboard shape, character set, thumb keys, Repeat keys, Magic keys, Adaptive swaps, and layout
  completeness.
- Describe the keys you want at exact positions using AND, OR, and exclude rules.
- Set metric limits from cmini, Cyanophage, or Mana2, then sort the results by any available stat,
  name, date, likes, or similarity.
- Build a custom source from any subset of the catalog when the full collection is too broad.

## Analyze and compare

- Switch between three independent analyzers without leaving the results.
- Find layouts similar to a reference, tune the match threshold, weight home positions, and include
  or require mirrored matches.
- Select interesting layouts as you browse and keep them visible even when they do not match the
  current filters.
- Compare two layouts side by side, including per-metric differences.
- Expand a layout for a cross-analyzer view of its statistics.

| Analyzer                                                   | Emulayout integration                                           |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| [cmini](https://github.com/Apsu/cmini)                     | Catalog-native statistics from selectable akl.gg corpora        |
| [Cyanophage](https://cyanophage.github.io/playground.html) | An independent metric set, plus a direct link to the playground |
| [Mana2](https://codeberg.org/Zakkkk/mana2)                 | Independent metric set from akl.gg corpus dumps                 |

Each analyzer retains its own metric definitions and units. cmini and Mana2 stats are imported from
[akl.gg](https://akl.gg/api/) dumps (Monkeyracer by default). Cyanophage is computed
locally. Adaptive swaps are not currently included in analyzer results.

## Try layouts in place

Every layout card can include a typing area, so layouts can be sampled without installing them.
Anglemod can be toggled per card, and links open the layout in Cyanophage or
[a specialized fork of Colemak Camp](https://colemakcamp.github.io) that supports links to typing
practice with a custom layout already configured.

Curated Magic-key and Adaptive-swap mappings also work in the typing area. Their indicators open an
inspectable mapping panel where an entire behavior type, a named mapping group, or an individual
mapping can be temporarily disabled. All mappings start enabled, and these choices are intentionally
ephemeral.

## Save and share a search

Selections and filter combinations can be saved as named views in the browser. A saved view can be
updated, duplicated, renamed, or shared as a URL. Shared views open with a preview so the recipient
can apply them temporarily or save their own copy.

Useful shortcuts:

| Shortcut                                                         | Action          |
| ---------------------------------------------------------------- | --------------- |
| <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>K</kbd>                    | Quick find      |
| <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd> | Compare layouts |

## Run locally

Install [mise](https://mise.jdx.dev/), then:

```sh
mise install
bun install
bun run dev
```

The layout catalog, authors, and input-behavior metadata under `static/` are required. On a fresh
checkout, populate them once before starting the development server:

```sh
bun run sync                   # or: bun run ./bin/catalog-sync.js
bun run dev
```

Analyzer stats are optional at runtime. Without them, catalog browsing, non-stat filters, layout
testing, selections, and saved views still work; analyzer displays, stat filters, and stat sorting
remain unavailable. Import cmini/Mana2 stats and compute Cyanophage via `bun run sync` (or the
individual `*-stats-sync` scripts) after the catalog exists.

### Generate analyzer data

```sh
bun run sync                              # interactive: choose targets + refresh mode
bun run ./bin/catalog-sync.js             # AKLDB API → catalog artifacts
bun run ./bin/cmini-stats-sync.js         # akl.gg → cmini stats
bun run ./bin/mana2-stats-sync.js         # akl.gg → Mana2 stats
bun run ./bin/cyanophage-stats-sync.js    # local Cyanophage compute
```

`bun run sync` opens a TUI to pick independent tasks (catalog, cmini stats, Mana2 stats, Cyanophage,
layout details) and whether to reuse caches (normal), re-download dumps (force), or stay offline.
Non-interactive wrapper examples:

```sh
bun run sync -- --all --force
bun run sync -- --catalog --cmini-stats --mana2-stats --cyanophage --details
bun run sync -- --all --offline
```

Catalog sync fetches the live [AKLDB](https://akldb.org/docs) API in its canonical `spark/1` format
and writes layout metadata under `static/`, excluding layouts that
akl.gg's [meme filter](https://akl.gg/api/) marks for the Monkeyracer corpus
(incomplete, or row-staggered Fspeed above the corpus cutoff). Override with
`--meme-corpus=NAME` or `CMINIBROWSER_MEME_FILTER_CORPUS`. cmini and Mana2 stats are imported from
[akl.gg](https://akl.gg/api/) dumps (Monkeyracer and Reddit by default). The
top-level sync always processes every configured corpus. To import only one corpus, invoke
`bin/cmini-stats-sync.js` or `bin/mana2-stats-sync.js` directly with `--corpus=NAME`, or set that
script's `CMINIBROWSER_CMINI_CORPUS` / `MANA2_STATS_CORPUS` environment override. Cyanophage stats
are computed locally from the catalog cache. All generated `static/*.json` files are gitignored; CI
checks both upstream sources hourly and regenerates/deploys only when published data changes.

Optional diagnostic (not run in CI):

```sh
bun run verify:cminibrowser-cmini-stats  # compare published cmini artifact to the dump encoder
```

### Common commands

| Command            | Purpose                                      |
| ------------------ | -------------------------------------------- |
| `bun run dev`      | Start the development server                 |
| `bun run build`    | Create a production build                    |
| `bun run preview`  | Preview the production build                 |
| `bun run sync`     | Run catalog and analyzer data sync tasks     |
| `bun run check`    | Run Svelte and TypeScript checks             |
| `bun run lint`     | Check formatting and lint the project        |
| `bun test`         | Run unit tests                               |
| `bun run test:e2e` | Run Playwright integration tests in Chromium |

## Generated data

`bin/catalog-sync.js` fetches layouts, authors, and metadata from the
[AKLDB API](https://akldb.org/docs), caching one coordinated snapshot under `.cache/akldb`. Spark
keys remain ordered positions, including free positions and repeated character labels. Emulayout
also requests AKLDB's derived `mana2/1` view solely to lower contextual Magic and chiral rules into
the current typing engine; Adaptive swaps and trigger identity come from the stored Spark payload.
The sync downloads akl.gg's `meme_filter.json` separately and writes the layout catalog, likes, and
behavior payload under `static/` with meme-tier layouts omitted.

A normal online sync compares AKLDB metadata before and after downloading the full projections and
authors. A failed, timed-out, malformed, schema-incompatible, drifting, or internally inconsistent
response keeps the last good cache and published catalog in place. Any structurally valid,
internally consistent response is authoritative regardless of additions, changes, and deletions.
The snapshot and four published catalog artifacts are each replaced atomically. Layout owner IDs,
author-map values, and like user IDs remain decimal strings so their full precision is preserved.
Likes come from each layout's `likes` array; only the count is published.

AKLDB's current `spark/1` schema does not identify a board. Imported layouts therefore use an
explicit `unknown` board instead of inferring one from key positions. The UI uses neutral ortholinear
geometry for previews, labels the board as unspecified, and withholds board-dependent Cyanophage
statistics until AKLDB defines that field or Emulayout adopts a separate authoritative source. A
rule-free conventional `@` remains Emulayout's dedicated Repeat behavior; mapped `@` rules override
it.

Analyzer artifacts are produced by separate scripts:

- `bin/cmini-stats-sync.js` — akl.gg cmini dumps → `static/layout-stats-cmini-{corpus}.json`
  (syncs Monkeyracer + Reddit unless `--corpus=` is set)
- `bin/mana2-stats-sync.js` — akl.gg Mana2 named dumps →
  `static/layout-stats-mana2-{corpus}-{board}-{space}.json` (defaults: all dump corpora ×
  `rowstag.none`)
- `bin/cyanophage-stats-sync.js` — local Cyanophage compute → `static/layout-stats-cyanophage.json`

The dump-backed sync scripts accept `--force` (unconditional re-download), `--offline` (reuse
`.cache/cminibrowser/` and `.cache/akldb/`), and `--corpus=NAME` (single corpus). Online
akl.gg syncs use conditional requests (ETag / Last-Modified) so unchanged dumps are not
re-downloaded. The top-level `bun run sync` wrapper accepts task selections plus `--force` or
`--offline`, but deliberately runs all configured corpora so the generated site and per-layout
detail payloads remain complete. Analyzer dumps must contain usable stats for at least 90% of the
published (non-meme-filtered) catalog before they can replace existing cache or published artifacts.
Cache and artifact replacements are atomic, so an invalid, incomplete, or interrupted download
leaves the last good files in place.
