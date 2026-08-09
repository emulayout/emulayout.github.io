# Keyboard input configuration

This document defines the reusable input-keyboard layer used to simulate a target layout when the
browser is receiving keys from a non-QWERTY operating-system or firmware layout. Typing practice
and the detail Test area share the same consumer model, while the configuration deliberately sits
below both features so catalog-card test areas can adopt it without separate preferences or
translation rules.

## Terminology and product model

- The **input layout** is the layout the browser reports through `KeyboardEvent.key`, such as
  Gallium.
- The **target layout** is the layout being tested or practiced, such as Vylet.
- A configured input key maps its emitted character to a physical main-grid slot or to a thumb hand
  and ordinal. The target character at the corresponding position becomes the base output sent to
  the existing Adaptive, Magic, and Repeat resolver.
- QWERTY on a staggered board is the initial input profile. It preserves the emulator's former
  physical-QWERTY behavior while making that assumption explicit and editable.
- The configuration is global and persists across routes and reloads. Typing practice and the
  detail Test area opt into it; index-card test areas retain their existing mapping until they are
  intentionally migrated.

The configuration modal offers two setup paths:

1. Choose any known catalog layout in the Base layout autocomplete. This replaces the draft values,
   keyboard type, and thumb metadata with that layout while retaining the complete QWERTY-sized
   main-grid topology.
2. Edit any key after choosing a base. Every effective value must be unique.

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
Every standard main-grid slot is always rendered. A missing or cleared value displays and resolves
through the QWERTY character for that slot; explicit values override those placeholders.

- Arrow Left and Arrow Right move through the flattened visual order. Right at a row's final key
  moves to the first key of the next row; Left at a row's first key moves to the final key of the
  previous row.
- Arrow Up and Arrow Down move to the same visual index in the adjacent row, clamping to its final
  key when that row is shorter.
- Tab and Shift+Tab keep their native form-navigation behavior.
- Thumb keys are ordinary editable fields in their own row. Their persisted left/right hand and
  within-hand order are part of physical identity. At least one slot per hand is always retained,
  even when the chosen base has no thumbs, so a saved input profile can later be used against a
  thumb-key target layout. Empty thumb slots are optional; nonempty values remain unique.

The editor blocks Save when two effective values are the same, including a collision between an
explicit value and another slot's QWERTY placeholder. Every field participating in a collision is
marked invalid and receives a border using the dedicated `--keyboard-input-validation-error` theme
variable. A non-blocking hint lists characters from the editor's standard ANSI set that are absent
from the effective mapping. Missing ANSI characters do not prevent Save because specialized input
layouts may intentionally use a different character set. Catalog layout data is loaded only when
the modal opens; an ordinary direct detail visit does not fetch the aggregate catalog merely
because the control exists.

## Persisted data

`src/lib/keyboardInputConfig.ts` owns the versioned `keyboardInputConfig` local-storage document.
The stored model contains:

- the base layout name as provenance for the autocomplete and trigger label;
- the two-value keyboard presentation type;
- key values keyed by stable `row,column` slots;
- optional left/right thumb-hand identity.

Parsing rejects unknown versions, malformed slots, duplicate effective values, and invalid thumb
metadata, then falls back to QWERTY. It restores missing standard main-grid slots and per-hand thumb
placeholders in older saved profiles. Components edit cloned drafts; only Save replaces the shared
state in `keyboardInputStore.svelte.ts` and writes local storage.

## Runtime translation

`withKeyboardInputConfig` compiles a saved input profile into the existing `LayoutTestKeyMaps`
boundary:

1. Resolve each input slot's explicit value, falling back to its QWERTY placeholder, and match
   `KeyboardEvent.key` to that effective input key.
2. For main-grid keys, use its row/column to find the target output already compiled by
   `createLayoutTestKeyMaps`. This preserves target angle transformations and legacy shifted output.
3. For thumb keys, match left/right hand and within-hand order to the target layout's thumb keys.
4. Pass the resulting target base output to `resolveLayoutInput`, where Adaptive, Magic, and Repeat
   behavior proceeds unchanged.

Shifted source letters and standard punctuation are compiled alongside their shifted target output.
Browser shortcuts and modifier handling remain owned by `LayoutTestArea`.

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
- Detail-page consumers: `src/lib/components/LayoutTypingPractice.svelte`,
  `src/lib/components/LayoutExpandedView.svelte`
- Pure coverage: `tests/keyboardInputConfig.test.ts`, `tests/layoutTestEmulator.test.ts`
- Browser coverage: `tests/e2e/layout-detail.e2e.ts`

## Invariants

- There is one global saved input profile, not one copy per test surface or target layout.
- Input-layout translation happens before target-layout contextual behavior.
- Main-grid identity is row/column; thumb identity is hand plus within-hand order.
- Every configuration retains the full standard QWERTY main-grid topology; sparse bases supply only
  overrides and never remove physical key fields.
- Every configuration retains visible left- and right-thumb slots; empty thumb mappings are inert.
- Selecting a base replaces the entire draft; editing afterward preserves its base name as
  provenance.
- Draft changes do not affect typing until Save.
- Catalog loading is modal-triggered and remains lazy on direct detail visits.
- Consumers that have not opted in preserve their current `KeyboardEvent.code` behavior.
