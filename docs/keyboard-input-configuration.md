# Keyboard input configuration

This document defines the reusable input-keyboard layer used to simulate a target layout when the
browser is receiving keys from a non-QWERTY operating-system or firmware layout. Typing practice,
the detail Layout test area, and catalog-card test areas share the same consumer model. The
configuration deliberately sits below those features so every test surface uses one preference and
one set of translation rules.

## Terminology and product model

- The **input layout** is the layout the browser reports through `KeyboardEvent.key`, such as
  Gallium.
- The **target layout** is the layout being tested or practiced, such as Vylet.
- A configured input key maps its emitted character to a physical main-grid slot or to a thumb hand
  and ordinal. The target character at the corresponding position becomes the base output sent to
  the existing Adaptive, Magic, and Repeat resolver.
- QWERTY on a staggered board is the initial input profile. It preserves the emulator's former
  physical-QWERTY behavior while making that assumption explicit and editable.
- The configuration is global and persists across routes and reloads. Typing practice, the detail
  Layout test area, and index-card test areas all apply it.
- The index page places the shared input-layout trigger beside the top-level Settings control. Below
  the small-screen breakpoint, it keeps only the keyboard icon visible and exposes the full label
  in a tooltip on hover or keyboard focus.

The configuration modal offers two setup paths:

An always-visible header hint explains that the input profile tells Emulayout which characters the
physical keyboard sends so typing practice and layout test areas can translate them to the target
layout.

1. Choose any known catalog layout in the Base layout autocomplete. This replaces the draft values,
   keyboard type, and thumb metadata with that layout while retaining the complete QWERTY-sized
   main-grid topology. Standard slots the imported layout does not define remain visible but inert;
   the source layout has no opinion about those keys.
2. Edit any key after choosing a base. Every effective value must be unique.

An untouched selected base names the shared trigger. Editing any key marks the configuration as
modified, so every trigger reads `Input layout: Custom` while the selected base remains visible in
the modal as provenance. Reselecting a base or Reset clears that modified state.

The base layout is optional. The modal initially focuses its autocomplete without opening the
listbox. Typing opens ranked matches, the chevron explicitly toggles an alphabetical list, and a
later refocus opens that default list. Selecting an option keeps focus in the field while closing
the list. The clear control removes the base provenance and empties every explicit value without
changing the keyboard shape; the QWERTY placeholders then remain the effective defaults.
Reset restores the modal draft to the complete staggered QWERTY default. Like other draft edits,
the reset does not replace the persisted input profile until Save is selected.

Keyboard type is currently `Ortho` or `Staggered`. Angle and stagger catalog layouts initialize as
Staggered; ortho and mini layouts initialize as Ortho. This choice controls editor presentation and
is retained independently after customization.

## Key editor interaction

Each key is a single-line selectable text field. Typing a printable key replaces its value and
moves focus to the next key. Backspace or Delete clears the current key without moving focus.
Every standard main-grid slot is always rendered. A slot omitted by an imported base stays blank
and inert until the user assigns it. A user-cleared mapped key resolves through the QWERTY
character for that slot; explicit values override those placeholders. Clear selected layout and
Reset remove imported inert state and restore the documented QWERTY fallback model.

- Arrow Left and Arrow Right move through the flattened visual order. Right at a row's final key
  moves to the first key of the next row; Left at a row's first key moves to the final key of the
  previous row.
- Arrow Up and Arrow Down move to the same visual index in the adjacent row, clamping to its final
  key when that row is shorter.
- Tab and Shift+Tab keep their native form-navigation behavior.
- Thumb keys are ordinary editable fields in their own row. Their persisted left/right hand and
  within-hand order are part of physical identity. At least one slot per hand is always retained,
  even when the chosen base has no thumbs, so a saved input profile can later be used against a
  thumb-key target layout. The QWERTY default leaves both thumb slots empty and inert. Users must
  explicitly assign ordinary real-key values to simulate thumb presses; modifier keys are never
  assigned automatically. Empty thumb slots are optional; nonempty values remain unique.

The editor blocks Save when two effective values are the same, including a collision between an
explicit value and another slot's QWERTY placeholder. Validation also reserves the browser-emitted
shifted alias for each letter and standard punctuation key, so configurations such as explicit `:`
beside `;` cannot compile an ambiguous `KeyboardEvent.key`. Every field participating in a
collision is marked invalid and receives a border using the dedicated
`--keyboard-input-validation-error` theme variable. A non-blocking hint lists characters from the
editor's standard ANSI set that are absent from the effective mapping. Missing ANSI characters do
not prevent Save because specialized input layouts may intentionally use a different character
set. Catalog layout data is loaded only when the modal opens; an ordinary direct detail visit does
not fetch the aggregate catalog merely because the control exists.

## Persisted data

`src/lib/keyboardInputConfig.ts` owns the versioned `keyboardInputConfig` local-storage document.
The stored model contains:

- the base layout name as provenance for the autocomplete and, while untouched, the trigger label;
- whether a key has been edited since that base was selected;
- the two-value keyboard presentation type;
- key values keyed by stable `row,column` slots;
- an optional inert marker for standard slots omitted by an imported base;
- optional left/right thumb-hand identity.

Parsing rejects unknown versions, malformed slots, duplicate effective values, and invalid thumb
metadata, then falls back to QWERTY. It restores missing standard main-grid slots and per-hand thumb
placeholders in older saved profiles. Version 2 adds the inert marker; version 3 adds the base
modified marker. Version-1 blank keys retain their former QWERTY fallback meaning during migration.
Components edit cloned drafts; only Save replaces the shared state in
`keyboardInputStore.svelte.ts` and writes local storage.

## Runtime translation

`withKeyboardInputConfig` compiles a saved input profile into the existing `LayoutTestKeyMaps`
boundary:

1. Ignore inert imported omissions. Resolve every other input slot's explicit value, falling back
   to its QWERTY placeholder, and match `KeyboardEvent.key` to that effective input key.
2. For main-grid keys, use its row/column to find the target output compiled from the structured
   display rows by `createLayoutTestKeyMaps`. The slot-indexed map preserves sparse holes, extended
   columns, target angle transformations, and shifted output.
3. For each nonempty thumb assignment, match its ordinary real-key value by left/right hand and
   within-hand order to the target layout's thumb keys. Empty thumb slots emit nothing.
4. Pass the resulting target base output to `resolveLayoutInput`, where Adaptive, Magic, and Repeat
   behavior proceeds unchanged.

Shifted source letters and standard punctuation are compiled alongside their shifted target output.
Control, Command/Meta, and Alt/Option are never treated as thumb keys; modified browser and
application shortcuts pass through the emulator.

Typing practice has one explicit exception to the saved thumb assignments: its optional Simulate
thumb keys mode omits them from `inputKeyMap` and resolves Space against the target layout's thumb
outputs using the next required lesson text. Other test surfaces always use the saved assignments.

The optional `inputKeyMap` on `LayoutTestKeyMaps` is the adoption seam. Existing consumers continue
to resolve `KeyboardEvent.code`; a consumer opts in by wrapping its ordinary target maps with
`withKeyboardInputConfig`. This keeps the shared DOM input component and contextual engine free of
route- or feature-specific preference imports.

## Code map

- Pure model, validation, navigation, and persistence codec: `src/lib/keyboardInputConfig.ts`
- Shared rune state and local-storage writes: `src/lib/keyboardInputStore.svelte.ts`
- Runtime target-map compiler: `src/lib/layoutTestEmulator.ts`
- Reusable modal trigger: `src/lib/components/KeyboardInputConfigControl.svelte`
- Catalog-backed modal: `src/lib/components/KeyboardInputConfigModal.svelte`
- Per-key editor and focus navigation: `src/lib/components/KeyboardInputEditor.svelte`
- Consumers: `src/lib/components/LayoutTypingPractice.svelte`,
  `src/lib/components/LayoutExpandedView.svelte`, `src/lib/components/LayoutCard.svelte`
- Pure coverage: `tests/keyboardInputConfig.test.ts`, `tests/layoutTestEmulator.test.ts`
- Browser coverage: `tests/e2e/layout-detail-input-layout.e2e.ts`

## Invariants

- There is one global saved input profile, not one copy per test surface or target layout.
- Input-layout translation happens before target-layout contextual behavior.
- Main-grid identity is row/column; thumb identity is hand plus within-hand order.
- Every configuration retains the full standard QWERTY main-grid topology; sparse bases mark
  unspecified standard slots inert and never remove their physical key fields.
- Home-key presentation always means the traditional eight resting keys: row 1, columns 0–3 and
  6–9. Extended columns are never home keys.
- Every configuration retains visible left- and right-thumb slots. The default mappings are empty
  and inert, and only explicitly assigned ordinary keys can produce target thumb outputs.
- Selecting a base replaces the entire draft. Editing afterward preserves its base name as
  provenance but labels the shared controls `Custom`.
- Draft changes do not affect typing until Save.
- Catalog loading is modal-triggered and remains lazy on direct detail visits.
- Consumers that have not opted in preserve their current `KeyboardEvent.code` behavior.
