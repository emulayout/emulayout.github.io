# Typing practice

This document records the product and architecture boundaries for the layout detail page's typing
practice. The feature currently supports generated and URL-authored lessons, timing, accuracy, WPM,
contextual-input guidance, and configurable physical input layouts while keeping its pure session
and calculation logic outside the renderer.

## Product model

- `Typing practice` is the first and default layout-detail tab. The layout creator reuses the same
  practice workspace, including Practice lesson settings for custom `text` and the `special`
  Magic/Adaptive word balance. Creator Edit and Preview share the show-page tabs for Typing
  practice, Layout test area, and Layout feel; free typing lives on Layout test area. In Edit the
  key editor stays on every tab so the live draft can be tested in any mode. Do not send
  typed test-area text to analytics. Catalog layout detail pages remain practice-only on this tab.
- Without custom text, each new lesson samples ten distinct words from the vendored English 1k
  list. The first remaining word is the active target.
  Random lessons also skip words that need a practiced-layout character with no physical mapping
  from the configured input keyboard (for example an unassigned thumb). Keys without a mapping
  show a red slash on the practice keyboard; hovering explains the exclusion, and thumb keys add a
  Simulate thumb keys suggestion. Custom `text` lessons are not filtered.
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
- The prompt and input use the same monospace typography and span the full panel width, matching
  Layout feel and Layout test area. The prompt stays on one clipped line; words beyond that width
  are hidden rather than wrapped. Creator Edit matches the section tabs, prompt, and input to
  the key-editor workspace width. Creator Edit also passes `compact` so Practice and Feel shrink the prompt,
  field, and score stats; Preview and catalog show pages keep the default large scale. Edit also
  shrinks Layout test area free typing to 130px.
- The input receives focus when Typing practice mounts. For a random lesson, Escape replaces the
  lesson with ten newly sampled words that exclude every word from the previous lesson. For a
  custom lesson, Escape restores its original URL-backed words. Both paths reset input, progress,
  timing, results, and contextual-input history while retaining focus.
- The practice field is a single-line text input sized to one line. Enter and paste input are
  ignored; ordinary typed output and layout-aware contextual behavior remain enabled.
- The input-layout control sits above the keyboard at the left edge of its keys. Left-aligned
  switches below the keyboard can highlight the next valid key, color the eight resting home keys,
  and show contextual special-key feedback when the layout has Magic or Adaptive mappings. The
  layout creator Edit keyboard receives the same option presentation as the preview keyboard.
  Next-key guidance respects shifted and contextual input output and is withheld while the current
  input
  contains an error or is waiting for a word-separating Space. Its decoration composes with home-key
  and active contextual-key styles. Home-key coloring is enabled by default.
- Layouts with curated Magic mappings add a default-on Underline magic group option. It underlines
  each target substring that can be entered with a Magic key, including the preceding rule context
  and emitted characters. A Magic trigger with repeat-last fallback also underlines adjacent doubled
  letters within a word. The hints follow disabled mappings and use the resolver's longest-rule
  precedence. Magic underlines and Magic keycap fills use `--magic-key`; keycap glyphs use
  `--magic-key-fg` for contrast against that fill. Adaptive underlines, armed Adaptive keycaps, and
  swap-path strokes use `--adaptive-key`.
- Layouts with curated Adaptive mappings similarly add a default-off Underline adaptive group
  option. It marks the preceding Adaptive trigger together with the target text that an enabled swap
  can produce after the full contextual-input pipeline resolves.
- The input-layout control opens a shared keyboard configuration modal. A user may seed every key,
  including thumbs, from any known catalog layout and then edit individual keys. The configuration
  is global and persisted, and Typing practice, the detail Layout test area, and index-card test
  areas apply it. Thumb simulation requires an explicitly assigned ordinary key; the default thumb
  slots are empty, and modifier keys are not thumb inputs. See
  [`keyboard-input-configuration.md`](./keyboard-input-configuration.md) for the reusable model and
  event-translation boundary.
- Thumb-key layouts add a default-off Simulate thumb keys option. While enabled, Space produces the
  thumb key whose fully resolved output matches the next required lesson text, including a thumb
  used as a Magic or Repeat key. Space remains a word separator when the current word is complete,
  and saved input-layout thumb assignments are ignored. Its help trigger remains available even
  when global help hints are hidden because the interaction changes the meaning of Space.
  Layout feel reuses the same switch: non-space thumb keystrokes appear as `_` in the remapped
  prompt, and Space inserts that marker instead of accepting the remapped letter on the thumb slot.
  Simulate also clears the unreachable-thumb slash and lets those letters back into random lessons.
- The keyboard is centered in its primary column together with its shared-switch options. The
  options stay left aligned to the keyboard inside that shared wrapper, in an unboxed responsive
  grid directly below it. Equal-width columns collapse from several columns to one as the keyboard
  narrows, keeping each switch aligned in orderly rows. Adaptive layouts add Show adaptive swaps
  there and reveal Show swap paths only while the Adaptive preview is enabled. Hiding the path
  control does not clear its persisted value, so it restores its prior state when the preview is
  enabled again. A default-off Only show relevant swaps option limits the preview and any paths to
  the armed pair containing a physical key that can produce the next required lesson character.
  When special keys are shown, a wider view keeps their mappings in a right-hand column capped at
  315px. The keyboard and mappings share one intrinsic-width wrapper so their combined footprint
  stays centered. At intermediate widths the mappings column narrows and presents one mapping per
  line. The keyboard derives its intrinsic width from the current board's actual row geometry and
  retains full-size keys until that board no longer fits beside the mappings or within the stacked
  region; only then does it scale down. Sparse boards still include the 10 keys on each letter row
  and empty keycaps for gaps between assigned letters, so a one-key creator preview keeps that
  width.
  Regions without room for both columns place that compact
  mappings panel beneath the keyboard and expand it to the full width of the shared keyboard area.
  At phone widths the keys and gaps continue scaling with the practice region, keeping the full
  keyboard inside the detail column instead of widening the page.
- The elapsed timer starts with the first character attempt, updates during the lesson, and stops
  when the final word completes.
- Completion reveals Accuracy and WPM in a row whose height is reserved throughout the lesson, so
  revealing results does not shift the keyboard. Accuracy is correct character attempts divided by
  all character attempts; deletions do not count as attempts. WPM uses the conventional
  five-character word and the lesson's completed characters, including inter-word spaces, over
  elapsed time.
- The completed prompt reads `Press esc to restart` and Escape immediately starts the next lesson.
- A trailing pencil button on random prompts opens the shared modal shell with the displayed lesson
  ready to edit. On Layout feel it sits on the remapped prompt row, not the quieter source-word
  line. Saving normalized nonempty text writes it to the URL and starts that custom lesson.
  Custom prompts replace the pencil with a trailing clear button; clearing removes `text` from the
  URL and returns to a random ten-word lesson.
- Keyboard display options persist across layouts and reloads in the versioned
  `typingPracticeDisplayOptions` local-storage document. Lesson state remains page-session-only;
  navigating away or reloading starts a new random lesson. Typing practice and Layout feel share
  that page-session lesson. Switching away from an in-progress Practice or Feel test clears the
  timer, input, and progress, keeps every word that has not been entered correctly, and — for a
  random lesson — appends newly sampled words so the lesson is ten words again (`0/10`). An
  untouched lesson is left as-is so unused random text does not reshuffle. Custom `text` lessons
  keep their leftover words (or restore the full custom text when none remain) and do not add
  random words. Layout feel also reuses this same display-options document (including Feel-only
  `ignoreWrongKeyPresses`) and the same shareable `text` / `special` lesson query. See
  [`layout-detail-page.md`](./layout-detail-page.md) for Feel’s remapped matching model; do not
  treat Feel as a second live-resolve practice field.

## State and input boundaries

`src/lib/typingPractice.ts` is the pure domain layer. A `TypingPracticeSession` owns the stable
remaining-word queue, current input, completed count, and original total. Pure helpers sample
without replacement, update input, check exact completion, advance the queue, and derive
per-character feedback. Random selection accepts an injectable source for deterministic tests. The
session and prompt derivation do not read the clock, touch browser state, or depend on Svelte.

`src/lib/typingPracticeMetrics.ts` owns pure attempt counting, elapsed-time formatting, and result
calculation. `SharedTypingPracticeLesson` in `src/lib/typingPracticeLesson.svelte.ts` owns the
page-session timestamps, attempt counts, source words, and progress for both Typing practice and
Layout feel. Each mounted tab runs the interval, starts the clock on the first recorded attempt,
and freezes it at completion. Keeping wall-clock state out of the session model lets timing and
result formulas remain deterministic in unit tests.

`src/lib/typingPracticeKeyboard.ts` resolves every valid next physical key from the remaining
target, available layout keys, contextual input profile, and current input history. It tests both
the base and shifted value of each physical key. This includes both a direct character key and an
enabled Repeat key when they emit the same next character.
The optional relevant-swap filter uses that same result even when next-key highlighting is disabled,
then retains both sides of each matching Adaptive pair. Keyboard presentation keeps next-key and
home-key styling as independent layers so existing Magic and Adaptive feedback continues to compose
normally.

The source vocabulary is vendored as `static/languages/english1k.json` from Monkeytype's
`english_1k` list at commit `d7eb4b76f3b3000199022ea52a52365b9346b8d0`. The file contains
1,000 frequency-ordered, unique words and is retained in its original JSON shape. Source:
[`english_1k.json`](https://github.com/monkeytypegame/monkeytype/blob/d7eb4b76f3b3000199022ea52a52365b9346b8d0/frontend/static/languages/english_1k.json).
Monkeytype identifies its repository license as GPL-3.0.

`src/lib/typingPracticeWords.ts` fetches and validates that static payload. The request starts only
when Typing practice or Layout feel first needs a random lesson, so direct Stats and Layout test
area visits do not download the word pool. `LayoutExpandedView.svelte` owns one
`SharedTypingPracticeLesson` for the page session; both tabs read that pool and lesson instead of
loading or sampling again on remount. Each UI still exposes loading and failure states before
showing a random session.

The layout-detail route owns canonical `tab`, `text`, and `special` query state and passes the
normalized lesson down through `LayoutExpandedView.svelte` to both Typing practice and Layout feel.
`LayoutTypingPractice.svelte` renders a live-resolve session over the shared source words.
`LayoutFeel.svelte` renders a remapped session over those same source words and progress.
`LayoutTestArea.svelte` continues to own physical-key handling and contextual-input resolution.
Its optional controlled-value callbacks let the practice and Feel consumers observe value changes
and replace the field after a resolved logical keypress. The resolved-input hook receives the full
resolver result so the completion-space path can record the logical attempt without duplicating the
input engine. Typing practice, the detail Layout test area, and catalog-card test areas supply an
input-layout key map compiled from the persisted configuration and structured display geometry.
Layout feel instead compiles identity maps so typed known-layout labels match the remapped prompt.

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
- Persisted results or richer keystroke analytics should extend the existing attempt-counting and
  resolved-input boundaries. Define explicitly how corrections, multi-character contextual output,
  and consumed Magic presses contribute before adding a durable result format. GoatCounter usage
  analytics in `docs/analytics.md` must stay limited to `practice-complete` and display-toggle
  events; do not send WPM, accuracy, lesson text, or per-keystroke data there.
- Additional persisted lesson state or resumable lessons require a separate explicit versioned
  storage format; do not persist the current in-memory session shape directly.

## Code map

- Session model and prompt feedback: `src/lib/typingPractice.ts`
- Timing, accuracy, and WPM calculations: `src/lib/typingPracticeMetrics.ts`
- Next-key guidance: `src/lib/typingPracticeKeyboard.ts`
- Display-option parsing and persistence format: `src/lib/typingPracticePrefs.ts`
- Layout-test display-option parsing and persistence format: `src/lib/layoutTestAreaPrefs.ts`
- Magic-group prompt hints: `src/lib/typingPracticeMagicGroups.ts`
- Adaptive-group prompt hints: `src/lib/typingPracticeAdaptiveGroups.ts`
- Custom-text parsing and URL parameter: `src/lib/typingPracticeText.ts`
- Input-layout model, validation, persistence, and target-map compiler:
  `src/lib/keyboardInputConfig.ts`, `src/lib/keyboardInputStore.svelte.ts`,
  `src/lib/layoutTestEmulator.ts`
- Reusable input-layout control and editor: `src/lib/components/KeyboardInputConfigControl.svelte`,
  `src/lib/components/KeyboardInputConfigModal.svelte`,
  `src/lib/components/KeyboardInputEditor.svelte`
- Shared persisted preference state: `src/lib/uiPrefs.svelte.ts`
- Lazy word-pool loader: `src/lib/typingPracticeWords.ts`
- Shared page-session lesson, progress, and word-pool ownership:
  `src/lib/typingPracticeLesson.ts`, `src/lib/typingPracticeLesson.svelte.ts`
- Vendored source vocabulary: `static/languages/english1k.json`
- Practice rendering and interaction: `src/lib/components/LayoutTypingPractice.svelte`
- Creator tabs and Edit practice workspace: `src/lib/components/LayoutCreator.svelte`,
  `src/lib/components/LayoutExpandedView.svelte`
- Layout-feel remapping and session UI: `src/lib/layoutFeel.ts`,
  `src/lib/components/LayoutFeel.svelte`
- Input-layout reachability, unreachable key titles, and random-word filtering:
  `src/lib/layoutKeyReachability.ts`
- Shared responsive keyboard, options, and mappings workspace:
  `src/lib/components/LayoutKeyboardWorkspace.svelte`
- Shared swap-path measurement for preview and edit keyboards:
  `src/lib/layoutKeyboardSwapPathLayer.ts`
- Preview letter-row and gap-key fill: `src/lib/layoutDisplay.ts` (`fillPreviewKeyboardRows`)
- Custom-text editor: `src/lib/components/TypingPracticeTextModal.svelte`
- Layout-aware controlled input: `src/lib/components/LayoutTestArea.svelte`
  (`compact` on the practice variant)
- Contextual input resolution: `src/lib/layoutInputBehaviors.ts`
- Unit coverage: `tests/typingPractice*.test.ts`, `tests/layoutFeel.test.ts`,
  `tests/layoutKeyReachability.test.ts`, `tests/layoutTestAreaPrefs.test.ts`
- Browser coverage: `tests/e2e/layout-detail-typing-practice.e2e.ts`,
  `tests/e2e/layout-detail-keyboard-preview.e2e.ts`, `tests/e2e/layout-detail-feel.e2e.ts`

## Invariants

- Non-final words require an exact active-word match followed by resolved Space; the final exact
  match advances immediately.
- The prompt queue, input field, progress count, and contextual history reset together on advance.
- Custom lesson resets reproduce the normalized URL text exactly; random lesson resets exclude the
  prior ten words.
- Remaining words retain stable identities as the head of the queue is removed.
- Prompt correctness is derived from session state; DOM classes are not a second source of truth.
- The timer starts once, stops once, and result values remain frozen after completion.
- Layout test area keeps independent free-typing text and contextual history. Typing practice and
  Layout feel share the page-session source word pool and leftover lesson words. Leaving either
  tab during a test clears the timer, input, and progress and refills a random lesson to ten
  words. Each tab still keeps its own input encoding (live-resolve source text vs remapped feel
  labels) and Feel-only flash/ignore-wrong-key UI.
- Input-layout translation precedes Adaptive, Magic, and Repeat resolution and does not change the
  displayed target layout or its contextual profile.
