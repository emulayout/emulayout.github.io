# Typing practice

This document records the product and architecture boundaries for the layout detail page's typing
practice. The current lesson is deliberately small, but its state model is intended to support
generated lessons, timing, accuracy, and speed metrics without moving those concerns into the
renderer.

## Product model

- `Typing practice` is the first and default layout-detail tab.
- The current lesson uses a fixed ten-word seed. The first remaining word is the active target.
- Each emitted input character is compared by position with the active target. Matching target
  characters are green, mismatches are red, and untyped characters remain neutral. Input beyond the
  target is displayed after it as incorrect feedback.
- Comparison uses the selected layout's logical output, after Adaptive, Magic, and Repeat behavior,
  rather than the physical key pressed.
- Space advances only when the input exactly equals the active word. A successful advance removes
  that word from the prompt, clears the field and contextual-input history, and increments progress.
  A premature space remains in the input and appears as an incorrect extra character.
- The elapsed-time display remains a placeholder. It does not start a clock yet.
- Practice state is page-session-only. Navigating away or reloading starts the seed lesson again.

## State and input boundaries

`src/lib/typingPractice.ts` is the pure domain layer. A `TypingPracticeSession` owns the stable
remaining-word queue, current input, completed count, and original total. Pure helpers update input,
check exact completion, advance the queue, and derive per-character feedback. It does not read the
clock, choose random words, touch browser state, or depend on Svelte.

`LayoutTypingPractice.svelte` owns one session and renders it. `LayoutTestArea.svelte` continues to
own physical-key handling and contextual-input resolution. Its optional controlled-value callbacks
let the practice consumer observe value changes and replace the field after a resolved logical
keypress. This hook receives the full resolver result so later metrics can inspect applied Adaptive,
Magic, or Repeat behavior without duplicating the input engine.

The successful-space path is intentionally ordered:

1. Resolve the physical key through the selected layout and contextual behaviors.
2. Offer the logical result to the practice session.
3. If it is a valid completion space, advance the session and replace the field with an empty value.
4. Otherwise, insert the logical output normally and update the session input.

## Future extensions

- A lesson generator can supply words to `createTypingPracticeSession`; stable word identities must
  remain unique even when generated lessons contain duplicates.
- Timing belongs in a separate clock/controller boundary. Keep timestamps and pause/resume rules out
  of prompt derivation so WPM calculations remain deterministic and unit-testable.
- Accuracy and keystroke metrics should consume resolved-input events. Define explicitly whether
  corrections, contextual expansions, and consumed Magic presses count before persisting results.
- Persisted preferences or resumable lessons require an explicit versioned storage format; do not
  persist the current in-memory session shape directly.

## Code map

- Session model and prompt feedback: `src/lib/typingPractice.ts`
- Practice rendering and interaction: `src/lib/components/LayoutTypingPractice.svelte`
- Layout-aware controlled input: `src/lib/components/LayoutTestArea.svelte`
- Contextual input resolution: `src/lib/layoutInputBehaviors.ts`
- Unit coverage: `tests/typingPractice.test.ts`
- Browser coverage: `tests/e2e/layout-detail.e2e.ts`

## Invariants

- Only an exact active-word match followed by resolved space advances the lesson.
- The prompt queue, input field, progress count, and contextual history reset together on advance.
- Remaining words retain stable identities as the head of the queue is removed.
- Prompt correctness is derived from session state; DOM classes are not a second source of truth.
- Test area and Typing practice keep independent text and contextual histories.
