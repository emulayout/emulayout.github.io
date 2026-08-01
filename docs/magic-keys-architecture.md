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

- a layout containing `*` is considered a Magic-key layout even before its mappings are curated;
- any symbol becomes a Magic key when a curated mapping uses it as a trigger;
- `@` is a Repeat key only when no curated Magic mapping claims `@`;
- a curated `@` Magic mapping completely overrides default Repeat-key behavior;
- an author who wants mapped `@` rules plus repeat fallback must explicitly set
  `"fallback": "repeat-last"`.

This makes unconfigured `@` deterministic without preventing authors from using it as an ordinary
Magic trigger.

## Presence and mapping metadata

Compact layout metadata keeps these facts separate:

- `hasMagicKey`: the layout contains `*`, or a curated Magic profile defines any trigger;
- `hasRepeatKey`: the layout contains `@` and no curated Magic profile defines `@`;
- `hasMagicKeyMappings`: curated Magic mappings are available;
- Adaptive-swap presence and mapping availability use their own flags.

`hasRepeatKey` has a dedicated compact wire flag. The generated metadata, rather than the client
inspecting `@`, is authoritative because the catalog generator has access to the curated profiles.
This prevents a missing or invalid runtime sidecar from accidentally reclassifying an author-mapped
`@` as a Repeat key.

Names are never used to infer either behavior.

## Curated Magic format

Magic mappings are stored by exact Cmini layout name:

```text
data/magic-keys/<layout-name>.json
```

The top-level object maps each Magic trigger to its rules. Each rule maps preceding emitted text to
the text emitted by the trigger:

```json
{
	"*": {
		"c": "k",
		"t": "ion"
	},
	"#": {
		"a": "o"
	}
}
```

Triggers need not be `*`. Multiple triggers, multi-character preceding sequences, and
multi-character output are supported. Preceding sequences match case-insensitively. Output is
emitted exactly as stored rather than inheriting case.

A trigger can explicitly repeat the previous character when no rule matches:

```json
{
	"@": {
		"mappings": {
			"a": "o"
		},
		"fallback": "repeat-last"
	}
}
```

Explicit rules take precedence over the fallback. Repeated output enters history, so `b@@` produces
`bbb` in this example. Without history, the trigger is emitted literally. A fallback-only trigger
may use an empty `mappings` object.

The same extended form is available for `*` or any other Magic trigger. Repeat fallback is never
injected into a curated Magic profile implicitly.

Validation rejects malformed or empty triggers, empty rule sets without a fallback, empty
preceding sequences or outputs, and preceding sequences that collide after lowercase
normalization. Sync also verifies that the layout and every configured trigger and preceding input
exist in Cmini. A mapped trigger is valid regardless of which symbol it uses.

## Runtime data and compilation

Sync publishes curated Magic and Adaptive mappings in:

```text
static/layout-input-behaviors.json
```

The detail-data generation step also copies the matching layout's source profile into its
`static/layout-details/<id>.json` payload. The aggregate sidecar remains authoritative for the
layout index; the per-layout copy lets direct detail and Quick Find views avoid downloading it.

Repeat keys do not need per-layout source records. The client combines the optional sidecar with
the authoritative compact layout metadata into one `LayoutInputProfile`:

```text
magicKeys? + repeatKey? + adaptiveSwaps?
```

Magic profiles remain mapping-driven. Repeat profiles contain only the conventional `@` trigger.
If the behavior sidecar cannot be loaded, Repeat behavior still works from compact metadata while
curated Magic behavior is reported as unavailable.

Pull-request validation rejects mapping files without a current Cmini layout. If Cmini removes a
layout after a mapping has merged, production sync warns and omits the orphan profile instead of
failing deployment.

## Resolution and history

For one captured layout key, the resolver:

1. applies at most one Adaptive swap to the base output;
2. treats that output as a possible Magic trigger;
3. if Magic matches, emits its rule, explicit fallback, or literal trigger;
4. otherwise, treats `@` as a possible Repeat trigger;
5. inserts the final output and appends it once to bounded shared history.

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

Recognized `*` markers whose mappings are unavailable remain muted and noninteractive. A layout
containing an unmapped `*` and a default `@` therefore exposes working Repeat behavior while
separately showing unavailable Magic behavior.

Filters are also independent:

- the Magic filter can require any Magic layout or only layouts with curated mappings;
- the Repeat filter can require or exclude default `@` Repeat behavior;
- an explicitly mapped `@` appears under Magic and not Repeat.

The layout detail page may show Magic and Adaptive controls, while Repeat remains controlled by the
icon beside the keyboard summary.

## Analyzer boundaries

Cmini and Cyanophage stats describe the base layout and do not incorporate contextual behavior.

Mana2 records Magic and Repeat analysis independently:

- a standalone supported Magic profile can use the extended engine;
- a standalone Repeat key expands to per-key `x@ -> xx` rules in the extended engine;
- a layout with both Magic and Repeat behavior stays on the standard engine because the current
  adapter supports only one contextual feature at a time;
- unsupported or unavailable Magic mappings use standard-engine stats with an explicit reason;
- an explicit `@` Magic mapping is analyzed as Magic, not Repeat.

Adaptive swaps are not currently included in Mana2 analysis.

## Architectural invariants

- Magic and Repeat are separate domain concepts, metadata flags, controls, filters, and analysis
  results.
- `*` implies Magic presence; `@` implies Repeat only when no curated `@` Magic mapping exists.
- Any curated trigger symbol establishes Magic behavior.
- Explicit `@` Magic mappings override default Repeat behavior completely.
- Repeat fallback inside a Magic profile is always explicit.
- Compact metadata is authoritative for feature classification.
- Feature-specific source files are combined only in generated runtime data.
- Matching uses uninterrupted emitted history, never text near the caret.
- The longest matching Magic preceding sequence wins.
- Adaptive swaps run before Magic, which runs before Repeat.
- Final output is inserted and added to history exactly once.
- Filtering uses compact metadata rather than mapping details.
- Analyzer metadata states independently which contextual behavior affected the result.
