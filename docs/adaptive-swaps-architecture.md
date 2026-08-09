# Contextual input architecture

This document records the decisions that matter when extending magic keys, adaptive swaps, the
layout test area, or a future dedicated typing page.

Reference for adaptive-swap behavior:
[Adaptive Swaps](https://notes.dario.ca/Personal/Adaptive-Swaps).
For magic-specific authoring and analyzer details, see
[`magic-keys-architecture.md`](./magic-keys-architecture.md).

## Data ownership

All curated authoring data for one layout lives in one file:

```text
data/layouts/<layout-name>.json
adaptive-layouts.txt
```

The JSON filename must exactly match the Cmini filename and `layout.name`.
[`layout-supplemental-data.md`](./layout-supplemental-data.md) is the reference for that file,
covering metadata, mapping variants, and staleness. This document covers what the mappings mean once
they are loaded.

`adaptive-layouts.txt` is the manually maintained presence list. It includes layouts known to use
adaptive swaps even when their mappings have not been curated. A layout whose supplemental data
defines adaptive swaps is automatically considered adaptive and does not also need to appear in this
list.

The Cmini sync validates the source data and publishes one runtime payload:

```json
{
	"example": {
		"variants": [
			{
				"id": "default",
				"magicKeys": {
					"mappings": { "*": { "c": "k" } }
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
		]
	}
}
```

The generated file is `static/layout-supplemental.json`. Repeat-key behavior is derived from compact
layout metadata rather than stored as a per-layout source profile. A layout may contain any
combination of these features, and the runtime loads the first variant.

`bin/layout-details.js` copies the matching normalized supplemental record, including every variant,
into each generated per-layout detail payload after the aggregate analyzer files are ready. This is
a delivery optimization only; the curated layout file and aggregate supplemental payload remain the
sources of truth.

Pull-request validation requires every curated file to match a current Cmini layout and to reference
only keys that layout has. Production sync is deliberately more resilient: if Cmini later removes a
layout, its file and any stale `adaptive-layouts.txt` presence entry produce warnings and are omitted
rather than failing the entire sync. If Cmini removes only a key one variant depends on, that variant
is published with `stale` instead of being dropped.

## Compact layout metadata

The compact layout tuple keeps presence independent from mapping availability:

- `hasMagicKey`: the base layout contains `*`, or any variant defines a Magic trigger.
- `hasRepeatKey`: the base layout contains `@` and the first variant does not claim `@`.
- `hasMagicKeyMappings`: any variant carries curated magic-key mappings.
- `cyanophageStatsNeedMagicMappings`: the default profile cannot be modeled by Cyanophage.
- `hasAdaptiveSwap`: the layout is in the curated presence list or any variant carries adaptive swaps.
- `hasAdaptiveSwapMappings`: any variant carries curated adaptive-swap mappings.

Mapping availability spans every variant so `Require with known mappings` still matches a layout
whose alternatives carry the feature. Repeat classification is scoped to the first variant instead,
because that is the profile the runtime compiles by default.

Filters use the presence flags for `Required` and the curated mapping flags for
`Require with known mappings`. Repeat has its own filter. The compact Repeat flag is authoritative,
so a missing behavior sidecar cannot accidentally reinterpret an explicitly mapped `@`.
Recognized triggers without available behavior receive a feature-specific muted, non-interactive
indicator.

## Magic-key source format

Under `magicKeys.mappings`, the outer key identifies a dedicated magic key. Each inner key is the
preceding emitted sequence; its value is the text emitted by the magic key.

```json
{
	"mappings": {
		"*": {
			"c": "k",
			"th": "e"
		}
	}
}
```

Preceding sequences and emitted values may contain multiple characters. Multiple dedicated magic
keys are supported.

Triggers normally use the compact form above. An extended trigger can wrap its rules in `rules` and
set `"fallback": "repeat-last"`. Explicit rules take precedence; otherwise the trigger repeats the
final character of uninterrupted emitted history.

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

The `mappings` object is the unconditional baseline. Optional labeled groups preserve source
organization:

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
swapped key exists on the Cmini layout, failing the pull-request gate and marking the variant stale
during production sync.

## Runtime resolution

`LayoutInputProfile` is the single compiled runtime model. It can independently contain
`magicKeys`, `repeatKey`, and `adaptiveSwaps`. The client compiles the generated payload and compact
layout metadata once into a map keyed by layout name.

`compileLayoutSupplementalRegistry` compiles every variant a layout publishes; the profile registry
the UI consumes takes the first one. A profile carries `variantId`, `variantLabel`, `outdated`, and
`stale` so a picker can be added without another format change.

For each captured layout key:

1. On a surface that has opted into input-layout configuration, translate the configured source
   character to the target layout's physical slot. Otherwise, resolve the physical key directly.
2. Start with the target layout's base output for that slot.
3. Apply at most one adaptive-swap lookup using the preceding uninterrupted emitted history.
4. Treat the Adaptive result as the candidate Magic-key trigger.
5. Apply at most one Magic-key rule.
6. If Magic did not match, apply Repeat-key behavior.
7. Insert the final output once.
8. Append that final output to bounded shared history.

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
- The optional input-layout compiler owns source-character-to-target-slot translation before this
  resolver. Typing practice is the first consumer; see
  [`keyboard-input-configuration.md`](./keyboard-input-configuration.md).
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
- On the layout detail page, mappings sit to the right of the emulator in the first Test-area row at
  wider viewports and stack below it on narrow screens.
- The detail page's Typing practice field uses the same resolver and disabled-mapping state as the
  Test area. Its keyboard preview derives prospective output from that field's own uninterrupted
  history so switching between the two sections does not mix contextual state.
- The detail page's styled keyboard accepts feature-neutral per-key feedback. After the current
  history ends in an Adaptive trigger, both keys in every enabled swap replace their base labels
  with the values they would emit and gain the active accent background. The shared preview switch
  disables this presentation alongside prospective Magic output. Typing practice has a separate,
  default-off relevance filter that retains only an armed pair containing a physical key that can
  produce the next required lesson character; it uses the same fully resolved next-key candidates as
  key highlighting and filters paths along with key feedback. Another default-off switch draws
  measured SVG connectors between every visible armed pair. Connector state follows the same
  history and disabled mappings but remains independent of the label-preview switch. The formatted
  text board never changes.

The resolver returns which behaviors were applied to a keypress. The keyboard preview derives
prospective outputs from the same profile and history, but the layout test area does not display an
applied-keypress event directly. Typing practice receives the full resolved-input result at its
controlled-input boundary so future accuracy and speed metrics can use it without duplicating the
resolver.

Disabled mapping state is owned by the current page, shared by the floating window and layout test
area on the index or by the mappings panel and keyboard summary on the detail route. It is
intentionally not persisted, and all mappings return to enabled after navigation or a page reload.

## Deferred work

### Variant selection

Curated data can publish several labeled mapping variants per layout, but the UI always loads the
first. A picker needs a place in the mappings window, a way to show `outdated` and `stale` without
implying a quality ranking, and a decision about whether the choice is session-only like the
enable/disable state or belongs in the URL.

### Persistent mapping preferences

If enable/disable preferences become persistent, store stable mapping identities rather than
rewriting the authoring data. Persistence needs an explicit migration strategy for renamed group
IDs and changed mapping rules.

### Position identity

The current engine resolves adaptive swaps from base output text because Cmini key identities are
unique in the supported layouts. If layouts gain duplicate base symbols or more complex layers,
carry the physical key code into the resolver and compile adaptive rules against positions.

### Analyzer accuracy

Cmini stats currently describe the base layout. Adaptive swaps are not included.

Cyanophage stats incorporate curated Magic / Repeat corpus rewrites when present; Adaptive
swaps are not included. See [`magic-keys-architecture.md`](./magic-keys-architecture.md).

Mana2 stats are imported from cminibrowser dumps and describe the base layout only. Adaptive swaps,
Magic keys, and Repeat keys are not folded into those metrics.

### Adaptive presence discovery

`adaptive-layouts.txt` is intentionally conservative because a layout name is not reliable feature
metadata. Replace or augment it if Cmini later exposes a standardized adaptive-presence field.
