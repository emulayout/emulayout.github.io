# Magic-key architecture

This document is the durable reference for understanding or changing magic keys in Emulayout. The
shared contextual-input engine and adaptive swaps are described in
[`adaptive-swaps-architecture.md`](./adaptive-swaps-architecture.md).

## Behavior

A magic key is a dedicated layout key whose output depends on the immediately preceding
uninterrupted logical output:

```text
c followed by * produces ck
t followed by * produces tion
```

The preceding text is already present when the magic key is pressed, so a rule stores only what
the magic key emits:

```json
{
	"*": {
		"c": "k",
		"t": "ion"
	}
}
```

Unlike an adaptive swap, a magic rule changes the output of a dedicated trigger key. A layout may
use either feature or both.

## Presence and known mappings

Layout metadata keeps two facts separate:

- `hasMagicKey`: the base layout contains a recognized `*` or `@` magic-key marker.
- `hasMagicKeyMappings`: Emulayout has curated mappings for the layout.

Names are not used to infer magic behavior. This distinction lets filters include all magic-key
layouts even when mappings are unavailable. Mapping controls appear only when there is curated data
to show; a muted, non-interactive feature indicator is shown when mappings are unknown.

## Curated format

Mappings are stored by exact Cmini layout name in:

```text
data/magic-keys/<layout-name>.json
```

The top-level object maps each dedicated magic key to its rules. Each inner key is the preceding
emitted sequence and its value is the text emitted by the magic key:

```json
{
	"*": {
		"c": "k",
		"'": "l",
		"l": "l"
	},
	"@": {
		"th": "e"
	}
}
```

The format supports multiple dedicated magic keys, multi-character preceding sequences, and
multi-character output. Preceding sequences match case-insensitively. Output is emitted exactly as
stored rather than automatically inheriting case.

Most triggers use the compact rule map above. A trigger that needs behavior when no explicit rule
matches uses the extended form:

```json
{
	"*": {
		"mappings": {
			"w": "h",
			"y": ","
		},
		"fallback": "repeat-last"
	}
}
```

`repeat-last` repeats the final character of uninterrupted emitted history, preserving its case
and allowing punctuation. Explicit mappings take precedence. A repeated character enters history,
so `a**` produces `aaa`; with no history, the magic key is emitted literally. A fallback-only
trigger may use an empty `mappings` object.

Validation rejects empty triggers, rule sets without a fallback, preceding sequences, and outputs,
as well as preceding sequences that collide after lowercase normalization. Sync also checks that
the layout and each configured magic trigger exist in Cmini.

## Runtime data

Sync publishes valid mappings in the merged per-layout behavior payload:

```text
static/layout-input-behaviors.json
```

The compact layout payload carries only the two presence flags. Filtering therefore does not
require loading or inspecting full mappings.

The client compiles the behavior payload once into profiles keyed by layout name. Magic rules are
ordered longest-first, and each profile records the maximum history length its rules need.

## Resolution, history, and chaining

For a captured layout key, the resolver:

1. receives the base output after any adaptive swap;
2. treats that output as a possible magic trigger;
3. chooses the longest rule whose preceding sequence matches the end of uninterrupted history;
4. emits the mapped value, applies the trigger's optional fallback, or emits the trigger literally;
5. appends the final output once to bounded shared history.

Output is not recursively processed during the same physical keypress. It becomes context for the
next keypress.

History represents uninterrupted logical output, not text near the caret. It is cleared by caret
navigation, pointer interaction, blur, native edits such as paste or deletion, and unmapped
non-modifier keys. Modifier keys alone do not clear it. Moving the caret therefore cannot make a
magic key inspect existing text at the new position.

Magic output enters history like ordinary output and can activate the next rule. Given:

```text
'* -> 'l
l* -> ll
```

typing `y o u ' * *` produces `you'll`: the first magic press emits `l`, and the second uses that
emitted `l` as its context.

## Composition with adaptive swaps

Adaptive swaps resolve before magic keys, and only the final output is added to their shared
history. Consequently:

- magic output can arm an adaptive swap on the next keypress;
- adaptive output can become context for a later magic key;
- adaptive output can become a magic trigger during the same keypress.

The pure resolver reports each behavior that applied independently of the inserted text and next
history. DOM events and history-reset decisions remain the layout test area's responsibility.

## Presentation and filtering

The mapping UI is shared with adaptive swaps and can display either or both sections. It renders
the complete result, such as `t* -> tion`, even though the stored value is only `ion`, and labels
any configured fallback after the explicit rules. The section, every explicit rule, and fallback
behavior have checkboxes that are enabled by default. Disabling is ephemeral and immediately
affects the layout test area; the section checkbox acts as a bulk control and shows a partial state
when only some mappings are enabled.

Layout-card feature indicators form a vertical rail immediately to the right of the formatted
keyboard. Known mappings use an interactive toggle that opens the single draggable, non-modal
mappings window; known mappings whose runtime sidecar is unavailable and features without known
mappings remain muted and noninteractive. When both magic keys and adaptive swaps have known
mappings, their glyphs share one toggle. The expanded stats modal also shows mappings above
analyzer statistics.

The Magic key filter distinguishes:

- all layouts with a magic-key marker;
- layouts with known mappings;
- layouts without a magic key.

## Analyzer boundaries

Cmini and Cyanophage stats describe the base layout and do not incorporate magic behavior.

Mana2 uses its extended engine only for profiles it can express: exactly one one-character magic
key, one-character preceding inputs and outputs, and referenced keys present on the layout. A
`repeat-last` fallback is expanded into per-key rules, with explicit mappings taking precedence.
Unsupported profiles use standard-engine stats. Results record whether mappings were included,
unavailable, or excluded with a reason, so base-layout stats are never presented as magic-aware.

Adaptive swaps are not currently included in Mana2 analysis.

## Architectural invariants

- Presence and known mapping availability are separate facts.
- Feature-specific source files are combined only in the generated runtime payload.
- Matching uses uninterrupted emitted history, never text near the caret.
- Magic output enters history and may be chained.
- The longest matching preceding sequence wins.
- Adaptive swaps run before magic keys.
- Final output is inserted and added to history exactly once.
- Event handling stays outside the pure resolver.
- Filtering uses compact metadata rather than mapping details.
- Analyzer metadata states whether magic behavior affected the result.
