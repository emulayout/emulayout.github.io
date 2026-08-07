# Supplemental layout data

Emulayout does not own the layouts it displays; they are synced from Cmini. Anything Emulayout knows
about a layout beyond its key map lives in one curated file per layout:

```text
data/layouts/<cmini-layout-name>.json
```

The filename is the identity. It must match the Cmini filename and `layout.name` exactly, so nothing
inside the file repeats the layout name.

This document is the reference for that file. For how the behaviors themselves resolve at runtime,
see [`magic-keys-architecture.md`](./magic-keys-architecture.md) and
[`adaptive-swaps-architecture.md`](./adaptive-swaps-architecture.md).

## The common case

A layout with one mapping set needs no variant wrapper:

```json
{
	"schema": 1,
	"meta": {
		"homepage": "https://example.com/sample"
	},
	"magicKeys": {
		"mappings": {
			"*": { "c": "k", "t": "ion" }
		}
	},
	"adaptiveSwaps": {
		"mappings": { "l": { "y": "j" } },
		"groups": [{ "id": "sfb", "label": "SFB", "mappings": { "s": { "c": "d" } } }]
	}
}
```

Every field except `schema` is optional, and a file may carry metadata with no mappings at all. The
file must contain at least one of `meta`, `magicKeys`, `adaptiveSwaps`, or `variants`.

## Fields

`schema` is required and currently `1`. It exists so a future format change can be migrated
explicitly rather than guessed.

`meta` is an open object of string values describing the layout. `homepage`, `repo`, `discussion`,
and `notes` are the recognized conventions, but any key is accepted, preserved, and published. New
kinds of information belong here rather than in a new top-level field.

`magicKeys` and `adaptiveSwaps` share the shape `{ mappings, groups? }`, where `mappings` is keyed by
trigger. Adaptive swaps support labeled `groups`; magic-key groups are reserved and currently
rejected, so an unsupported `groups` fails loudly instead of being silently dropped.

A magic trigger written as `{ "rules": …, "fallback": … }` also says what an unmapped preceding key
does: `"repeat-last"` repeats the previous character, `{ "emit": "the" }` types fixed text, and
`"no-op"` types nothing. Omitting `fallback` behaves like `"no-op"`; see
[`magic-keys-architecture.md`](./magic-keys-architecture.md) for the details.

## Alternatives

A layout can offer more than one mapping set. Move the feature objects into `variants`:

```json
{
	"schema": 1,
	"variants": [
		{
			"id": "v2",
			"label": "2026 revision",
			"magicKeys": { "mappings": { "*": { "c": "k" } } }
		},
		{
			"id": "v1",
			"label": "Original",
			"description": "The author's first published set.",
			"outdated": true,
			"magicKeys": { "mappings": { "*": { "c": "ck" } } }
		}
	]
}
```

A variant is an alternative, not a ranking. A later version is not assumed to be better, so nothing
in the format implies quality order.

The **first variant is the default**: it is what the runtime loads and what repeat-key classification
is scoped to. Promoting an alternative means moving it to the top of the list. There is no `default`
flag to keep in sync with the ordering.

Inside `variants`, `id` is always required. It is the stable identity that a future variant picker or
saved preference keys on, so treat it as permanent once merged. `label` is required as soon as a file
lists more than one variant, since a label exists to tell alternatives apart and an unlabeled one
would not be selectable. Each variant must define `magicKeys`, `adaptiveSwaps`, or both.

A file uses the shorthand or `variants`, never both. Mixing them is rejected.

## When the layout changes underneath a mapping

Layouts are synced from upstream and can change without warning. Mappings are keyed on characters
rather than positions, so a key moving around the board does not break them. Two signals cover the
cases that matter, and neither asks a contributor to record a hash, a date, or a layout snapshot.

`stale` is derived by sync. If a variant references a key the layout no longer has, sync warns,
publishes `"stale": true` on that variant, and keeps it loadable. Never write `stale` yourself; it is
rejected in curated files and recomputed on every sync.

`outdated` is author-declared. Set it on a variant that still works but no longer reflects intent for
the current layout, and explain why in `label` or `description`.

The two checks differ deliberately by context. `bun run validate:mappings`, which gates pull
requests, treats a missing key as a hard error so broken data cannot merge. Production sync treats
the same condition as a warning so an upstream layout change degrades one variant instead of failing
a deployment.

## Adding or changing a file

1. Create or edit `data/layouts/<layout-name>.json`.
2. Run `bun run validate:mappings`.

Validation rejects unknown fields anywhere except inside `meta`, so a typo fails rather than being
silently ignored. It also checks the structural rules each feature already enforces: empty triggers
or rule sets, preceding sequences that collide once lowercased, self-swaps, reversed duplicate swaps,
and a trigger that assigns one key to two swaps.

## Published form

Sync normalizes the shorthand away and writes `static/layout-supplemental.json`, so the client only
ever sees the variants form:

```json
{
	"sample": {
		"schema": 1,
		"meta": { "homepage": "https://example.com/sample" },
		"variants": [{ "id": "default", "magicKeys": { "mappings": { "*": { "c": "k" } } } }]
	}
}
```

`outdated` and `stale` appear only when true. The shorthand's implicit variant id is `default`.

The normalized form is itself valid input: the client revalidates each published entry with the same
validator before compiling it, so `schema` is carried through rather than stripped. Any narrowing of
the validator has to stay satisfiable by its own output, or every entry is silently rejected at
runtime and layouts lose their mappings while the compact feature flags still say they exist.

## Related data that lives elsewhere

`adaptive-layouts.txt` remains a separate list of layouts known to use adaptive swaps whose mappings
are not curated here. It is presence-only information, and folding it in would require a supplemental
file that declares nothing.

## Code map

- `src/lib/layoutSupplemental.ts` — types, validation, shorthand normalization, referenced-key
  collection, default-variant selection.
- `bin/layout-data.js` — loads `data/layouts/*.json` and compiles each variant to surface structural
  errors.
- `bin/input-mapping-validation.js` — checks each variant's keys against the Cmini layout, fatally
  for the pull-request gate and as staleness for sync.
- `bin/catalog-sync.js` — derives the compact feature flags and publishes
  `static/layout-supplemental.json`.
- `src/lib/layoutInputBehaviors.ts` — compiles the published payload into runtime profiles.
