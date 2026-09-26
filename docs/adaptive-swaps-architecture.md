# Contextual input architecture

This document records the decisions that matter when extending Magic keys, Adaptive swaps, the
Layout test area, Typing practice, or Layout feel.

Reference for adaptive-swap behavior:
[Adaptive Swaps](https://notes.dario.ca/Personal/Adaptive-Swaps).
For Magic-specific runtime and analyzer details, see
[`magic-keys-architecture.md`](./magic-keys-architecture.md).

## Data ownership

The canonical source for layouts, Magic-key intent, chiral-key intent, and Adaptive swaps is
AKLDB's stored `spark/1` payload. Catalog sync also requests AKLDB's derived `mana2/1` projection so
it can lower contextual Magic and chiral rules into Emulayout's current runtime representation. The
derived projection is not treated as a second source of layout truth.

`bin/akldb-spark.js` adapts those two views and publishes the existing client-facing payload during
catalog sync:

```json
{
	"example": {
		"schema": 1,
		"variants": [
			{
				"id": "default",
				"magicKeys": {
					"mappings": {
						"*": { "rules": { "c": "k" }, "fallback": "repeat-last" }
					}
				},
				"adaptiveSwaps": {
					"mappings": { "l": { "y": "j" } }
				}
			}
		]
	}
}
```

The behavior is attached directly to each AKLDB layout record, so no name or historical filename
join is required. `bin/layout-details.js` copies the matching normalized record into each generated
per-layout detail payload as a delivery optimization.

Emulayout has no local mapping files, mapping contribution workflow, variant selection, staleness
metadata, or manually maintained Adaptive presence list. Updating the data means updating
AKLDB. The importer rejects malformed or mutually inconsistent Spark and Mana2 projections before
it replaces the last good cached snapshot.

## Compact layout metadata

The compact layout tuple retains its existing wire fields for compatibility:

- `hasMagicKey`: AKLDB provides a Magic or chiral profile.
- `hasRepeatKey`: the base layout contains `@` and AKLDB does not provide mapped `@` rules.
- `hasMagicKeyMappings`: same source boundary as `hasMagicKey`.
- `cyanophageStatsNeedMagicMappings`: the default profile cannot be modeled by Cyanophage.
- `hasAdaptiveSwap`: AKLDB provides one or more Adaptive swaps.
- `hasAdaptiveSwapMappings`: same source boundary as `hasAdaptiveSwap`.

The presence and mapping-availability flags are now equal because the canonical snapshot supplies both
facts together. The duplicate fields and `Require with known mappings` filter values remain to avoid
a wire-format and saved-filter migration. The compact Repeat flag stays authoritative if the
generated behavior payload cannot be loaded.

## Source adaptation

AKLDB's Mana2 projection stores the complete contextual result. Emulayout stores only what pressing
the Magic key emits, so the importer removes the `after` prefix:

```json
{ "after": "c", "output": "ck" }
```

becomes `"c": "k"`. Spark identifies Magic and chiral triggers while Mana2 supplies their flattened
contextual rules. Multiple triggers and multi-character contexts remain supported.

A conventional rule-free `@` whose Spark default has repeat semantics is omitted from the Magic
payload and represented by Emulayout's dedicated Repeat profile. Mapped `@` rules remain Magic and
override that profile.

Spark Adaptive entries already store one side of a two-way swap:

```json
{ "trigger": "l", "swap": ["y", "j"] }
```

The importer lowercases these case-insensitive identities and compiles both directions:

```text
after l: base y emits j
after l: base j emits y
```

## Runtime resolution

`LayoutInputProfile` is the single compiled runtime model. It can independently contain
`magicKeys`, `repeatKey`, and `adaptiveSwaps`. The client compiles the generated payload and compact
layout metadata once into a map keyed by layout name.

`compileLayoutSupplementalRegistry` compiles the generated default profile for each layout.

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

Adaptive rule identities are normalized to lowercase. Magic and chiral contexts remain
case-sensitive so the runtime preserves AKLDB's lowered semantics. A shifted adaptive input
preserves uppercase intent in the swapped output.

## UI boundaries

- `LayoutTestArea` owns DOM keyboard events, textarea edits, and history resets.
- The optional input-layout compiler owns source-character-to-target-slot translation before this
  resolver. Typing practice and the detail Layout test area opt into the shared saved configuration;
  catalog-card test areas retain physical-code resolution. Layout feel uses the same saved
  configuration to remap planned target keystrokes onto known-layout labels, then matches identity
  input against that remapped prompt. See
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
  or Adaptive mapping updates that feature's control. The control normalizes native button and SVG
  geometry across engines, and its hover-only treatment is limited to fine pointers so touch WebKit
  does not retain a false hover state.
- On the layout detail page, the free-form Layout test area emulator remains full width above the
  shared keyboard workspace. Mappings sit to the right of the keyboard-and-options cluster at wider
  workspace widths and expand beneath it on narrow screens, matching Typing practice.
- The detail page's Typing practice field uses the same resolver and disabled-mapping state as the
  Layout test area. Its keyboard preview derives prospective output from that field's own
  uninterrupted history so switching between the two sections does not mix contextual state.
  Layout feel plans Magic and Adaptive shortcuts on the practiced layout first, remaps those
  keystrokes onto the known layout, and reconstructs emit history from the correct remapped prefix
  (including a typed Magic literal alternate). It does not live-resolve target Magic while typing.
- The detail page's styled keyboard accepts feature-neutral per-key feedback. After the current
  history ends in an Adaptive trigger, both keys in every enabled swap replace their base labels
  with the values they would emit and gain the `--adaptive-key` background. The shared preview switch
  disables this presentation alongside prospective Magic output. Typing practice has a separate,
  default-off relevance filter that retains only an armed pair containing a physical key that can
  produce the next required lesson character; it uses the same fully resolved next-key candidates
  as key highlighting and filters paths along with key feedback. Another default-off switch draws
  measured SVG connectors between every visible armed pair. Connector state follows the same
  history and disabled mappings but remains independent of the label-preview switch. The formatted
  text board never changes.

Typing practice also offers a separate, default-off Adaptive-group underline. For each enabled swap
that can produce the next part of a lesson word, it marks the preceding Adaptive trigger and the
final emitted target text. This derivation runs through the complete Adaptive-then-Magic-then-Repeat
pipeline, follows disabled mappings, and does not alter the default prompt presentation. Layout feel
reuses the same underline option on the remapped prompt; Adaptive stays preferred-only at match
time because the swapped key is the true key at that moment.

Typing practice's lesson source is URL-backed and edited in the Practice lesson modal: custom text
(`text`) or random words with a special-key word balance (`special`, 0–100 percent). The balance
finds candidate words by checking each pooled word against the currently enabled Magic and Adaptive
mappings using the same group derivations that drive the underlines, so disabling a mapping or group
for the session also excludes its words. At 100 the lesson uses only matching words, cycling a small
candidate set to fill the lesson; when nothing matches the enabled mappings it falls back to
ordinary random words. Custom text replaces the random source, so the two never coexist in canonical
URL state. Mapping toggles regenerate a lesson that has not been typed into yet; once typing starts,
the change applies on the next restart.

The resolver returns which behaviors were applied to a keypress. The keyboard preview derives
prospective outputs from the same profile and history, but the layout test area does not display an
applied-keypress event directly. Typing practice receives the full resolved-input result at its
controlled-input boundary so its attempt counting and completion metrics do not duplicate the
resolver. Layout feel’s field is identity input against the remapped prompt; Magic/Adaptive
planning happens up front in `planFeelWord`, not on each keypress. Future persisted results or
richer keystroke analytics should extend that same boundary.

Disabled mapping state is owned by the current page, shared by the floating window and layout test
area on the index or by the mappings panel and keyboard summary on the detail route. It is
intentionally not persisted, and all mappings return to enabled after navigation or a page reload.

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

Cmini stats come from akl.gg stats/v1 and include stored Magic/Repeat behavior. Adaptive swaps are
not included.

Cyanophage stats incorporate AKLDB Magic / Repeat corpus rewrites when present; Adaptive swaps are
not included. See [`magic-keys-architecture.md`](./magic-keys-architecture.md). AKLDB layouts are
geometry-neutral, so Emulayout computes separate column-stagger and row-stagger Cyanophage
artifacts and selects between them using the viewer's display preference.

Mana2 stats are imported from akl.gg stats/v1 and include stored Magic/Repeat behavior. Adaptive
swaps are not folded into those metrics.
