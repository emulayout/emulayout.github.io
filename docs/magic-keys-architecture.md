# Magic-key and Repeat-key architecture

This document is the durable reference for the distinction between Magic keys and Repeat keys in
Emulayout. The shared contextual-input engine and Adaptive swaps are described in
[`adaptive-swaps-architecture.md`](./adaptive-swaps-architecture.md).

## Two separate concepts

A Magic key has author-defined output that depends on uninterrupted preceding output:

```text
c followed by * produces ck
t followed by * produces tion
```

A Repeat key has one fixed behavior:

```text
@ repeats the previous uninterrupted emitted character
```

`*` is the conventional Magic-key marker. `@` is the conventional Repeat-key marker. They are
separate features even though both use the same contextual-input engine.

The conventions are deliberately overridable:

- any symbol can be a Magic or native chiral trigger;
- `@` is a Repeat key when it is present on the layout and AKLDB provides no mapped `@` rules,
  including the conventional rule-free repeat declaration;
- mapped `@` rules completely override default Repeat-key behavior;
- mapped `@` rules remain Magic behavior.

This makes unconfigured `@` deterministic without preventing authors from using it as an ordinary
Magic trigger.

## Presence and mapping metadata

Compact layout metadata carries these facts:

- `hasMagicKey`: AKLDB provides a Magic profile;
- `hasRepeatKey`: the layout contains `@` and AKLDB does not provide mapped `@` rules;
- `hasMagicKeyMappings`: same source boundary as `hasMagicKey`;
- `cyanophageStatsNeedMagicMappings`: the default profile cannot be modeled by Cyanophage;
- Adaptive-swap presence and mapping availability use their own flags.

`hasRepeatKey` has a dedicated compact wire flag. The generated metadata, rather than the client
inspecting `@`, is authoritative because the catalog generator has access to the canonical profile.
This prevents a missing or invalid runtime sidecar from accidentally reclassifying a mapped
`@` as a Repeat key.

Names are never used to infer either behavior.

## Generated Magic format

Magic and Adaptive intent comes from AKLDB's stored `spark/1` payload. The shared Spark compiler derives client behavior directly from that content. AKLDB's derived
`mana2/1` projection remains an analyzer input only. Chirals remain native. See
[`adaptive-swaps-architecture.md`](./adaptive-swaps-architecture.md#source-adaptation) for the
source-to-runtime conversion. The derived compiler output stores each trigger under
`magicKeys.mappings`.

Inside `mappings`, each key is a Magic trigger and each rule maps preceding emitted text to the text
emitted by the trigger:

```json
{
	"mappings": {
		"*": {
			"c": "k",
			"t": "ion"
		},
		"#": {
			"a": "o"
		}
	}
}
```

Triggers need not be `*`. Multiple triggers, multi-character preceding sequences, and
multi-character output are supported. Preceding sequences are case-sensitive, as required by
Spark compilation. Output is emitted exactly as stored.

## Fallback behavior

A press whose preceding output matches no rule is governed by the trigger's `fallback`:

| `fallback`          | Behavior when no rule matches           |
| ------------------- | --------------------------------------- |
| `"repeat-last"`     | Emits the previous character again      |
| `{ "emit": "the" }` | Emits that fixed letter or word         |
| `"no-op"`           | Emits nothing; the keypress is consumed |
| omitted             | Same as `"no-op"`                       |

```json
{
	"mappings": {
		"@": {
			"rules": {
				"a": "o"
			},
			"fallback": "repeat-last"
		}
	}
}
```

Explicit rules take precedence over the fallback. Emitted output enters history, so `b@@` produces
`bbb` in this example. `repeat-last` with no history has nothing to repeat and degrades to `no-op`;
fixed text needs no history and always applies. A Magic key never types its own trigger symbol, so a
consumed press adds nothing to history and leaves later matching undisturbed.

Omitting `fallback` and writing `"no-op"` behave identically. Because it produces no output, `no-op`
gets no toggle in the mappings panel and cannot on its own justify a trigger: a
trigger needs at least one rule or an emitting fallback. A trigger whose only behavior is its
fallback may use an empty `rules` object.

The inner key is `rules` rather than `mappings` so it does not collide with the feature-level
`mappings` wrapper. The same extended form is available for `*` or any other Magic trigger.

The importer rejects a malformed or inconsistent AKLDB snapshot before replacing the last good
cached copy. Runtime validation also rejects malformed or empty triggers, unusable rule sets or
fallbacks, and empty contexts or outputs.

Mana2's historical extended CLI adapter expanded `repeat-last` and single-character `{ "emit": … }`
fallbacks into bigram rules. Emulayout no longer runs that adapter; published Mana2 stats come from
akl.gg's revision-matched stats/v1 objects.

## Runtime data and compilation

The direct `/try` Spark importer adapts raw rules using an explicit fixed-text fallback equal to
the base trigger. Chirals use the native resolver. Unmatched raw/chiral presses and chiral exceptions
therefore retain ordinary key output. Magic declarations retain their own explicit defaults.
Literal whitespace contexts are preserved and matched exactly;
the shared runtime does not synthesize Spark's initial space context. See `layout-creator.md`
for the direct-import boundaries.

Sync publishes Spark behavior documents in:

```text
static/layout-supplemental.json
```

The detail-data generation step also copies the matching layout's preserved Spark document
into its `static/layout-details/<id>.json` payload. The aggregate payload
remains authoritative for the layout index; the per-layout copy lets direct detail and Quick Find
views avoid downloading it.

Repeat keys do not need per-layout source records. The client combines the optional behavior
sidecar with authoritative compact layout metadata into one `LayoutInputProfile`:

```text
magicKeys? + repeatKey? + adaptiveSwaps?
```

Magic profiles remain mapping-driven. Repeat profiles contain only the conventional `@` trigger.
If the behavior sidecar cannot be loaded, Repeat behavior still works from compact metadata while
AKLDB behavior is reported as unavailable.

## Resolution and history

For one captured layout key, the resolver:

1. receives the target layout's base output after any opted-in input-layout translation;
2. applies at most one Adaptive swap to the base output;
3. treats that output as a possible Magic trigger;
4. if Magic matches, emits its rule or fallback, emitting nothing for a consumed press;
5. otherwise, treats `@` as a possible Repeat trigger;
6. inserts the final output and appends it once to bounded shared history.

Magic and Repeat are not recursively applied during the same physical keypress. A Magic match also
prevents the resulting text from being interpreted as Repeat output. This makes an explicit `@`
Magic profile a complete override even in defensive or malformed combined runtime data.

History represents uninterrupted logical output, not text near the caret. It is cleared by caret
navigation, pointer interaction, blur, native edits such as paste or deletion, and unmapped
non-modifier keys. Modifier keys alone do not clear it.

Magic and Repeat output enter history like ordinary output. Given:

```text
'* -> 'l
l* -> ll
```

typing `y o u ' * *` produces `you'll`: the first Magic press emits `l`, and the second uses that
emitted `l` as context.

## Composition with Adaptive swaps

Adaptive swaps resolve before Magic and Repeat behavior. Only the final output is added to shared
history. Consequently:

- Magic or Repeat output can arm an Adaptive swap on the next keypress;
- Adaptive output can become context for later contextual behavior;
- Adaptive output can become a Magic or Repeat trigger during the same keypress.

The pure resolver reports `adaptive-swap`, `magic-key`, and `repeat-key` independently. DOM events,
text insertion, and history-reset decisions remain the layout test area's responsibility.

## Presentation and filtering

Magic and Adaptive behavior use the shared mappings window. Repeat toggles the entire behavior
directly and never opens a mappings window. All three use the same borderless feature-control
component and `on`, `off`, and `unavailable` visual language; Repeat uses only `on` and `off`.

Filters are also independent:

- Chiral keys appears after Adaptive swap and before Character set. Its `chiralKey` URL parameter
  accepts `optional` (default, omitted), `excluded`, and `required`. The former
  `required-mapped` value in URLs and saved settings is normalized to `required`.
  It participates in active chips, Adjust, resets, saved views, sharing, and backups like Adaptive.
  Dedicated compact flags record Spark chiral presence and native mapping availability; it does
  not require fetching the supplemental payload. Older catalog tuples without these flags report
  neither until regenerated by catalog sync. Native Chiral profiles do not count as Magic; requiring both features requires both profiles.
- Magic and Adaptive filters offer Optional, Excluded, and Required. Their former
  `required-mapped` URL and saved-setting values normalize to `required`, since AKLDB supplies
  presence and mappings together;
- the Repeat filter can require or exclude default `@` Repeat behavior;
- an explicitly mapped `@` appears under Magic and not Repeat.

The layout detail page shows Magic and Adaptive mapping controls in the active typing workspace.
Repeat stays enabled there and has no detail-page toggle.

The detail page's styled keyboard provides an optional prospective Magic preview, enabled by
default. While enabled, every known Magic trigger is rendered with the Magic symbol used by layout
cards instead of its literal marker. A default Repeat `@` uses the Repeat symbol from the same
feature-icon set, not the
Magic sparkles. `@` that is only a repeat-last Magic fallback (no enabled mapping rules) also uses
the Repeat symbol. Mapped `@` rules stay Magic. Each typing surface resolves mapped triggers against
its own current uninterrupted emitted history and the page's shared disabled-mapping set:

- Magic triggers use the `--magic-key` fill with `--magic-key-fg` glyph or label color;
- Repeat keys use the same fill with the Repeat glyph until they can emit;
- Native chiral triggers use `--chiral-key` teal fill and `--chiral-key-fg` foreground,
  distinct from Magic purple. Their mapping checkboxes use the same teal palette.
- Adaptive armed keys use the `--adaptive-key` fill; swap-path strokes use the same token;
- when pressing the trigger would emit a value, the keycap displays that value;
- when no rule or emitting fallback applies, the Magic or Repeat symbol remains on the keycap;
- turning the Layout test area preview off restores literal trigger characters and ordinary key
  styling; Typing practice and Layout feel suppress this feedback when Show special keys is off.

This is prospective state, not a second input resolver: the keyboard derives it with the same pure
Magic resolver used by the emulator. The renderer accepts feature-neutral key feedback and combines
it with currently armed Adaptive swaps without changing the formatted text board. When a physical
key is both a Magic trigger and part of an armed Adaptive swap, the Adaptive presentation wins
because Adaptive changes that physical key before Magic behavior is considered.

Typing practice also offers a separate, default-off Magic-group underline. It marks the preceding
context and emitted target characters for every enabled rule that can replace part of a lesson word.
For a trigger with repeat-last fallback, eligible adjacent doubled letters in the same word are
marked as one group. The derivation uses compiled rule precedence and the current disabled-mapping
set; it does not alter input resolution or the default prompt presentation.

Native chiral groups retain separate underline indexes in both Typing practice and Layout feel:
Magic is purple, Chiral teal, and Adaptive orange. Overlapping enabled groups use Adaptive over
Chiral over Magic color precedence. Magic and Chiral share the existing persisted underline
preference; its label names Chiral when present. Disabled, excepted, ordinary-output, and
Magic-shadowed chiral rules do not create chiral underlines.

Layout feel plans those same Magic shortcuts into the remapped prompt and underlines the remapped
keystroke spans. The prompt and next-key highlight keep the preferred Magic trigger. When Magic
emits a single character, typing the remapped literal letter for that emit is also accepted;
multi-character Magic emits stay preferred-only. Do not add Adaptive literal alternates.

## Analyzer boundaries

Cmini stats are imported from akl.gg stats/v1. For layouts with contextual rules, akl.gg computes
the published cmini cells with the stored Magic/Repeat behavior applied. Adaptive swaps are not
included.

Cyanophage stats follow the Magic playground (`keyboard_svg_magic.js`) when AKLDB provides a
supported Magic profile (and optionally a default Repeat key):

- corpus words are rewritten before scoring (`letter + expansion` → `letter + magic key`,
  and doubled letters → `letter + @` for Repeat);
- only single-character preceding Magic contexts are applied; multi-character contexts and
  Emulayout fallbacks are ignored so results stay comparable to Cyanophage's Magic page;
- profiles with multiple Magic triggers are not measured, because Cyanophage models only one;
- Magic layouts are measured when the AKLDB profile fits Cyanophage's supported subset;
- layouts measured this way may still be playground-incompatible for deep-links;
- Adaptive swaps are not included.

Mana2 stats are imported from the same akl.gg stats/v1 object. For layouts with contextual rules,
akl.gg computes the published Mana2 cells with the stored Magic/Repeat behavior applied. Adaptive
swaps are not included.

## Architectural invariants

- Magic and Repeat are separate domain concepts, metadata flags, controls, filters, and analysis
  results.
- AKLDB's Spark payload is authoritative for Magic presence and behavior.
- `@` implies Repeat only when AKLDB does not provide mapped `@` rules.
- Stored chiral triggers establish native Chiral behavior independently of Magic classification.
- Explicit `@` Magic mappings override default Repeat behavior completely.
- Repeat fallback inside a Magic profile is always explicit.
- A Magic trigger never types its own symbol; an unmatched press emits nothing.
- Compact metadata is authoritative for feature classification.
- Magic and Adaptive presence always include mappings because both come from the same AKLDB snapshot.
- Matching uses uninterrupted emitted history, never text near the caret.
- The longest matching Magic preceding sequence wins.
- Adaptive swaps run before Magic, then native Chiral, then Repeat. The first matching contextual behavior wins.
- Final output is inserted and added to history exactly once.
- Filtering uses compact metadata rather than mapping details.
- Analyzer metadata states independently which contextual behavior affected the result.
  Cyanophage may rewrite corpus words for Magic/Repeat; akl.gg applies stored Magic/Repeat behavior
  to its cmini and Mana2 cells.
