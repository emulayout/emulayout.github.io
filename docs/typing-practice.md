# Typing practice

This document records the product and architecture boundaries for the layout detail page's typing
practice. The current lesson is deliberately small, but its state model is intended to support
generated lessons, timing, accuracy, and speed metrics without moving those concerns into the
renderer.

## Product model

- `Typing practice` is the first and default layout-detail tab.
- Without custom text, each new lesson samples ten distinct words from the vendored English 1k
  list. The first remaining word is the active target.
- The shareable `text` query parameter replaces the random lesson with its normalized,
  whitespace-separated words. Duplicate words are retained. Escape resets a custom lesson to the
  same text; it does not select random words. The custom text remains in the URL while switching
  layout-detail tabs.
- Each emitted input character is compared by position with the active target. Matching target
  characters are green, mismatches are red, and untyped characters remain neutral. Input beyond the
  target remains visible in the field and counts toward accuracy, but is not appended to the prompt.
- Any mismatch, including input beyond the target, turns all text in the input field red until the
  input is corrected. Prompt and field feedback use the dedicated `--typing-practice-correct` and
  `--typing-practice-incorrect` theme variables.
- Comparison uses the selected layout's logical output, after Adaptive, Magic, and Repeat behavior,
  rather than the physical key pressed.
- Space advances when the input exactly equals a non-final active word. The final word advances and
  ends the test as soon as its last correct character is entered, without requiring Space. A
  successful advance removes that word from the prompt, clears the field and contextual-input
  history, and increments progress. A premature space remains in the input and counts as an
  incorrect attempt without changing the rendered prompt text.
- The prompt and input use the same monospace typography. The prompt stays on one clipped line;
  words beyond the available width are hidden rather than wrapped.
- The input receives focus when Typing practice mounts. For a random lesson, Escape replaces the
  lesson with ten newly sampled words that exclude every word from the previous lesson. For a
  custom lesson, Escape restores its original URL-backed words. Both paths reset input, progress,
  timing, results, and contextual-input history while retaining focus.
- The practice field is a single-line text input sized to one line. Enter and paste input are
  ignored; ordinary typed output and layout-aware contextual behavior remain enabled.
- Left-aligned keyboard options can highlight the next valid key, color the eight resting home
  keys, and show contextual special-key feedback when the layout has Magic or Adaptive mappings.
  Next-key guidance respects contextual input output and is withheld while the current input
  contains an error or is waiting for a word-separating Space.
- The keyboard is centered in its primary column together with its shared-switch options. The
  options stay left aligned to the keyboard inside that shared wrapper, in one unboxed row directly
  below it. Adaptive layouts add Show Adaptive swaps there and reveal Show swap paths only while the
  Adaptive preview is enabled. When special keys are shown, a wider view keeps their mappings in a
  right-hand column capped at 315px beside the larger keyboard column; smaller views stack the
  centered keyboard group before the mappings.
- The elapsed timer starts with the first character attempt, updates during the lesson, and stops
  when the final word completes.
- Completion reveals Accuracy and WPM in a row whose height is reserved throughout the lesson, so
  revealing results does not shift the keyboard. Accuracy is correct character attempts divided by
  all character attempts; deletions do not count as attempts. WPM uses the conventional
  five-character word and the lesson's completed characters, including inter-word spaces, over
  elapsed time.
- The completed prompt reads `Press esc to restart` and Escape immediately starts the next lesson.
- A trailing pencil button on random prompts opens the shared modal shell with the displayed lesson
  ready to edit. Saving normalized nonempty text writes it to the URL and starts that custom lesson.
  Custom prompts replace the pencil with a trailing clear button; clearing removes `text` from the
  URL and returns to a random ten-word lesson.
- Keyboard display options persist across layouts and reloads in the versioned
  `typingPracticeDisplayOptions` local-storage document. Lesson state remains page-session-only;
  navigating away or reloading starts a new random lesson.

## State and input boundaries

`src/lib/typingPractice.ts` is the pure domain layer. A `TypingPracticeSession` owns the stable
remaining-word queue, current input, completed count, and original total. Pure helpers sample
without replacement, update input, check exact completion, advance the queue, and derive
per-character feedback. Random selection accepts an injectable source for deterministic tests. The
session and prompt derivation do not read the clock, touch browser state, or depend on Svelte.

`src/lib/typingPracticeMetrics.ts` owns pure attempt counting, elapsed-time formatting, and result
calculation. `LayoutTypingPractice.svelte` owns the page-session timestamps and interval, starts the
clock on the first recorded attempt, and freezes it at completion. Keeping wall-clock state out of
the session model lets timing and result formulas remain deterministic in unit tests.

`src/lib/typingPracticeKeyboard.ts` resolves every valid next physical key from the remaining
target, available layout keys, contextual input profile, and current input history. This includes
both a direct character key and an enabled Repeat key when they emit the same next character.
Keyboard presentation keeps next-key and home-key styling as independent layers so existing Magic
and Adaptive feedback continues to compose normally.

The source vocabulary is vendored as `static/languages/english1k.json` from Monkeytype's
`english_1k` list at commit `d7eb4b76f3b3000199022ea52a52365b9346b8d0`. The file contains
1,000 frequency-ordered, unique words and is retained in its original JSON shape. Source:
[`english_1k.json`](https://github.com/monkeytypegame/monkeytype/blob/d7eb4b76f3b3000199022ea52a52365b9346b8d0/frontend/static/languages/english_1k.json).
Monkeytype identifies its repository license as GPL-3.0.

`src/lib/typingPracticeWords.ts` fetches and validates that static payload. The request starts only
when `LayoutTypingPractice.svelte` mounts, so direct Stats and Test area visits do not download the
word pool. The practice UI exposes loading and failure states before creating a session.

The layout-detail route owns canonical `tab` and `text` query state and passes normalized custom text
down through `LayoutExpandedView.svelte`. `LayoutTypingPractice.svelte` owns one session and renders
it. `LayoutTestArea.svelte` continues to own physical-key handling and contextual-input resolution.
Its optional controlled-value callbacks let the practice consumer observe value changes and replace
the field after a resolved logical keypress. This hook receives the full resolver result so later
metrics can inspect applied Adaptive, Magic, or Repeat behavior without duplicating the input engine.

The successful-space path is intentionally ordered:

1. Resolve the physical key through the selected layout and contextual behaviors.
2. Offer the logical result to the practice session.
3. If it is a valid completion space, advance the session and replace the field with an empty value.
4. Otherwise, insert the logical output and update the session input. If that completes the final
   word, finish the test and replace the field with an empty value immediately.

## Future extensions

- Other lesson generators can supply words to `createTypingPracticeSession`; stable word identities
  must remain unique even when generated lessons contain duplicates.
- Pause/resume and idle-time rules belong beside the existing component-owned clock. Keep them out
  of prompt derivation so WPM calculations remain deterministic and unit-testable.
- Accuracy and keystroke metrics should consume resolved-input events. Define explicitly whether
  corrections, contextual expansions, and consumed Magic presses count before persisting results.
- Additional persisted lesson state or resumable lessons require a separate explicit versioned
  storage format; do not persist the current in-memory session shape directly.

## Code map

- Session model and prompt feedback: `src/lib/typingPractice.ts`
- Timing, accuracy, and WPM calculations: `src/lib/typingPracticeMetrics.ts`
- Next-key guidance: `src/lib/typingPracticeKeyboard.ts`
- Display-option parsing and persistence format: `src/lib/typingPracticePrefs.ts`
- Custom-text parsing and URL parameter: `src/lib/typingPracticeText.ts`
- Shared persisted preference state: `src/lib/uiPrefs.svelte.ts`
- Lazy word-pool loader: `src/lib/typingPracticeWords.ts`
- Vendored source vocabulary: `static/languages/english1k.json`
- Practice rendering and interaction: `src/lib/components/LayoutTypingPractice.svelte`
- Custom-text editor: `src/lib/components/TypingPracticeTextModal.svelte`
- Layout-aware controlled input: `src/lib/components/LayoutTestArea.svelte`
- Contextual input resolution: `src/lib/layoutInputBehaviors.ts`
- Unit coverage: `tests/typingPractice.test.ts`
- Metrics unit coverage: `tests/typingPracticeMetrics.test.ts`
- Word-pool loading coverage: `tests/typingPracticeWords.test.ts`
- Browser coverage: `tests/e2e/layout-detail.e2e.ts`

## Invariants

- Non-final words require an exact active-word match followed by resolved Space; the final exact
  match advances immediately.
- The prompt queue, input field, progress count, and contextual history reset together on advance.
- Custom lesson resets reproduce the normalized URL text exactly; random lesson resets exclude the
  prior ten words.
- Remaining words retain stable identities as the head of the queue is removed.
- Prompt correctness is derived from session state; DOM classes are not a second source of truth.
- The timer starts once, stops once, and result values remain frozen after completion.
- Test area and Typing practice keep independent text and contextual histories.
