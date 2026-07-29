# Contextual input architecture

This document records the decisions that matter when extending magic keys, adaptive swaps, the
layout test area, or a future dedicated typing page.

Reference for adaptive-swap behavior:
[Adaptive Swaps](https://notes.dario.ca/Personal/Adaptive-Swaps).
For magic-specific authoring and analyzer details, see
[`magic-keys-architecture.md`](./magic-keys-architecture.md).

## Data ownership

Curated authoring data stays feature-specific:

```text
data/magic-keys/<layout-name>.json
data/adaptive-swaps/<layout-name>.json
adaptive-layouts.txt
```

The JSON filename must exactly match the Cmini filename and `layout.name`.

`adaptive-layouts.txt` is the manually maintained presence list. It includes layouts known to use
adaptive swaps even when their mappings have not been curated. A layout with an adaptive mapping
file is automatically considered adaptive and does not also need to appear in this list.

The Cmini sync validates the source data and publishes one merged runtime payload:

```json
{
	"example": {
		"magicKeys": {
			"*": { "c": "k" }
		},
		"adaptiveSwaps": {
			"mappings": {
				"l": { "y": "j" }
			},
			"groups": [
				{
					"id": "comfort",
					"label": "Comfort",
					"mappings": {
						"w": { "s": "m" }
					}
				}
			]
		}
	}
}
```

The generated file is `static/layout-input-behaviors.json`. Repeat-key behavior is derived from
compact layout metadata rather than stored as a per-layout source profile. A layout may contain any
combination of these features.

Pull-request validation requires every mapping profile to match a current Cmini layout. Production
sync is deliberately more resilient: if Cmini later removes a layout, its mapping profile and any
stale `adaptive-layouts.txt` presence entry produce warnings and are omitted rather than failing
the entire sync.

## Compact layout metadata

The compact layout tuple keeps presence independent from mapping availability:

- `hasMagicKey`: the base layout contains `*`, or a curated mapping defines any Magic trigger.
- `hasRepeatKey`: the base layout contains `@` and no curated Magic mapping claims `@`.
- `hasMagicKeyMappings`: curated magic-key mappings are available.
- `hasAdaptiveSwap`: the layout is in the curated presence list or has an adaptive mapping file.
- `hasAdaptiveSwapMappings`: curated adaptive-swap mappings are available.

Filters use the presence flags for `Required` and the curated mapping flags for
`Require with known mappings`. Repeat has its own filter. The compact Repeat flag is authoritative,
so a missing behavior sidecar cannot accidentally reinterpret an explicitly mapped `@`.
Recognized triggers without available behavior receive a feature-specific muted, non-interactive
indicator.

## Magic-key source format

The outer key identifies a dedicated magic key. Each inner key is the preceding emitted sequence;
its value is the text emitted by the magic key.

```json
{
	"*": {
		"c": "k",
		"th": "e"
	}
}
```

Preceding sequences and emitted values may contain multiple characters. Multiple dedicated magic
keys are supported.

Triggers normally use the compact form above. An extended trigger can wrap its rules in
`mappings` and set `"fallback": "repeat-last"`. Explicit rules take precedence; otherwise the
trigger repeats the final character of uninterrupted emitted history.

A curated `@` trigger is Magic behavior and completely overrides the default Repeat-key
classification. If the author wants unmatched `@` inputs to repeat, the profile must explicitly use
`"fallback": "repeat-last"`. Any symbol present on the layout can be a curated Magic trigger.

## Repeat-key behavior

An unclaimed `@` key repeats the final character of uninterrupted emitted history. It has a
dedicated runtime profile, mapping identity, UI section, compact metadata flag, filter, and analyzer
result. With no history it remains literal. No authoring file is required.

## Adaptive-swap source format

An adaptive mapping stores one side of a two-way swap:

```json
{
	"mappings": {
		"l": { "y": "j" }
	}
}
```

This compiles to both behaviors:

```text
after l: base y emits j
after l: base j emits y
```

The top-level `mappings` object is the unconditional baseline. Optional labeled groups preserve
source organization:

```json
{
	"mappings": {
		"l": { "y": "j" }
	},
	"groups": [
		{
			"id": "slides",
			"label": "Slides",
			"mappings": {
				"p": { "h": "m" }
			}
		}
	]
}
```

Every stored group is enabled by default. The mapping UI can disable a whole labeled group or any
individual swap for the current page session. The stable `id` associates each compiled rule with
its group, while `label` remains presentation text.

Validation rejects empty profiles, malformed keys, self-swaps, reversed duplicates, and any trigger
that assigns the same base key to more than one swap. Sync also verifies that every trigger and
swapped key exists on the Cmini layout.

## Runtime resolution

`LayoutInputProfile` is the single compiled runtime model. It can independently contain
`magicKeys`, `repeatKey`, and `adaptiveSwaps`. The client compiles the generated payload and compact
layout metadata once into a map keyed by layout name.

For each captured layout key:

1. Start with the base layout output for the physical key.
2. Apply at most one adaptive-swap lookup using the preceding uninterrupted emitted history.
3. Treat the Adaptive result as the candidate Magic-key trigger.
4. Apply at most one Magic-key rule.
5. If Magic did not match, apply Repeat-key behavior.
6. Insert the final output once.
7. Append that final output to bounded shared history.

Output is not recursively processed during the same physical keypress. It can trigger behavior on
the next keypress through history. The explicit Adaptive-then-Magic-then-Repeat order also means an
Adaptive output may become a contextual trigger during the same keypress.

History represents uninterrupted logical input, not text near the caret. Navigation, pointer
repositioning, blur, paste, undo, deletion, or another native edit clears it. Magic-key and
Repeat-key output is stored as history, so contextual behavior can chain. Multi-character output
contributes its final bounded suffix.

Rule identities are normalized to lowercase. A shifted adaptive input preserves uppercase intent
in the swapped output.

## UI boundaries

- `LayoutTestArea` owns DOM keyboard events, textarea edits, and history resets.
- The pure resolver owns matching, precedence, case handling, and bounded history.
- `InputMappingsPanel` renders Magic and Adaptive feature sections and their ephemeral
  enable/disable controls. Section and group checkboxes are bulk controls over their individual
  mappings and show a partial state when only some children are enabled.
- `LayoutInputMappingsIndicator` renders a vertical feature rail beside the formatted keyboard.
  Each feature delegates to `LayoutInputFeatureControl`, which owns one geometry, hover/focus
  treatment, and three visual states: `on`, `off`, and `unavailable`. `off` is interactive and
  struck through; `unavailable` means mapping data is absent and is noninteractive. Repeat toggles
  directly, while Magic and Adaptive controls open `InputMappingsWindow`. Turning off every Magic
  or Adaptive mapping updates that feature's control.
- The expanded stats modal also renders the mappings panel above analyzer stats.

The resolver returns which behaviors were applied to a keypress. The layout test area does not
currently display this, but a dedicated typing page may use it later.

Disabled mapping state is owned by the current layout-results view, shared by the floating window,
expanded modal, and layout test area, and is intentionally not persisted. All mappings return to
enabled after a page reload.

## Deferred work

### Persistent mapping preferences

If enable/disable preferences become persistent, store stable mapping identities rather than
rewriting the authoring data. Persistence needs an explicit migration strategy for renamed group
IDs and changed mapping rules.

### Position identity

The current engine resolves adaptive swaps from base output text because Cmini key identities are
unique in the supported layouts. If layouts gain duplicate base symbols or more complex layers,
carry the physical key code into the resolver and compile adaptive rules against positions.

### Analyzer accuracy

Cmini and Cyanophage stats currently describe the base layout. Adaptive swaps are not included.

Mana2 support needs an explicit experiment for two-way swaps, overlapping rules, shared triggers,
and layouts combining Adaptive swaps with other contextual behavior. Result metadata reports Magic
and Repeat inclusion independently so a combined layout cannot be marked fully included when only
one behavior was analyzed.

Analyzer cache keys should include only the affected layout's merged behavior profile and inclusion
result.

### Adaptive presence discovery

`adaptive-layouts.txt` is intentionally conservative because a layout name is not reliable feature
metadata. Replace or augment it if Cmini later exposes a standardized adaptive-presence field.
