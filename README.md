# Emulayout

**A workbench for exploring alternative keyboard layouts.**

Search the community-maintained [cmini](https://github.com/Apsu/cmini) catalog, narrow it down with
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
| [cmini](https://github.com/Apsu/cmini)                     | Catalog-native statistics using the Monkeyracer corpus          |
| [Cyanophage](https://cyanophage.github.io/playground.html) | An independent metric set, plus a direct link to the playground |
| [Mana2](https://codeberg.org/Zakkkk/mana2)                 | Independent metric set from cminibrowser corpus dumps           |

Each analyzer retains its own metric definitions and units. cmini and Mana2 stats are imported from
[cminibrowser](https://cminibrowser.com/api/) dumps (Monkeyracer by default). Cyanophage is computed
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
bun run ./bin/cmini-sync.js
bun run dev
```

Analyzer stats are optional at runtime. Without them, catalog browsing, non-stat filters, layout
testing, selections, and saved views still work; analyzer displays, stat filters, and stat sorting
remain unavailable. In the normal local workflow, cmini stats are generated alongside the required
catalog and checked as part of the same generated data set.

### Generate analyzer data

```sh
bun run ./bin/cmini-sync.js  # refresh catalog, cmini stats, and Cyanophage stats
bun run ./bin/mana2-sync.js  # generate Mana2 stats
```

The cmini sync currently creates its catalog and analyzer outputs together. Mana2 generation is
independent and imports cminibrowser dumps (no local Go toolchain). All generated `static/*.json`
files are gitignored; CI regenerates them for deployments and the daily catalog sync.

### Common commands

| Command                     | Purpose                                            |
| --------------------------- | -------------------------------------------------- |
| `bun run dev`               | Start the development server                       |
| `bun run build`             | Create a production build                          |
| `bun run preview`           | Preview the production build                       |
| `bun run check`             | Run Svelte and TypeScript checks                   |
| `bun run lint`              | Check formatting and lint the project              |
| `bun test`                  | Run unit tests                                     |
| `bun run test:e2e`          | Run Playwright integration tests in Chromium       |
| `bun run validate:mappings` | Validate every curated supplemental layout file    |
| `bun run audit:blacklist`   | Report stale entries in the local layout blacklist |

## Generated data

`bin/cmini-sync.js` clones cmini into `.cache/cmini-repo` and generates the layout catalog, cmini
stats, Cyanophage stats, likes, and supplemental layout data under `static/`. Curated supplemental
data comes from `data/layouts/`; `adaptive-layouts.txt` records layouts known to use Adaptive swaps
even when their mappings have not yet been curated. A layout key named `@` repeats the previous
uninterrupted emitted character by default, so that behavior does not require a curated file. A
curated Magic mapping whose trigger is `@` overrides the default and may opt back into repeat
fallback explicitly.

`bin/mana2-sync.js` downloads cminibrowser Mana2 named dumps and writes
`static/layout-stats-mana2-{corpus}-{board}-{space}.json` (defaults:
`monkeyracer.rowstag.none`). Extended dump fields are written alongside for
show-page detail payloads only. Use `--offline` after the first download to
reuse `.cache/cminibrowser/`.

## Contribute supplemental layout data

Everything Emulayout knows about a layout beyond its key map, including Magic-key mappings, Adaptive
swaps, a homepage, and other metadata, lives in one file at `data/layouts/<layout-name>.json`. The
filename must exactly match its cmini layout name. The simplest useful file is:

```json
{
	"schema": 1,
	"magicKeys": {
		"mappings": {
			"*": { "c": "k" }
		}
	}
}
```

See [`docs/layout-supplemental-data.md`](docs/layout-supplemental-data.md) for the full format,
including how to offer alternative mapping versions and what happens when a layout changes upstream.

Run the cmini sync at least once to populate `.cache/cmini-repo`, then validate:

```sh
bun run validate:mappings
```

Validation checks:

- the file structure and permitted fields, rejecting typos outside the open `meta` object;
- the filename against the layout name and blacklist;
- every Magic-key trigger and Adaptive swap key against the corresponding layout; and
- orphan files whose layout is not present in the current cmini catalog.

Pull requests run this validation automatically through the
`Validate mappings / Validate mapping files` check and reject orphan files. Production syncs are
deliberately more resilient: if cmini removes a layout after its data merges, the sync warns and
omits the orphan instead of blocking deployment, and a variant that references a key cmini has since
removed is published as stale rather than dropped.

For local blacklist maintenance, compare `layout-blacklist.txt` with the cached cmini catalog:

```sh
bun run audit:blacklist
```

The audit is read-only and exits successfully after reporting entries that are not currently
present. Review them before removal because a layout may have been removed only temporarily.
