# Typing practice

This document records the product and architecture boundaries for the layout detail page's typing
practice. The feature currently supports generated and URL-authored lessons, timing, accuracy, WPM,
contextual-input guidance, and configurable physical input layouts while keeping its pure session
and calculation logic outside the renderer.

## Product model

- `Typing practice` is the first and default layout-detail tab. The layout creator reuses the same
  practice workspace, including Practice lesson settings for custom `text`, the `special`
  Magic/Adaptive word balance, and random-lesson word count (`10`, `25`, or `50`). Creator Edit and Preview share the show-page tabs for Typing
  practice, Layout test area, and Layout feel; free typing lives on Layout test area. In Edit the
  key editor stays on every tab so the live draft can be tested in any mode. Do not send
  typed test-area text to analytics. Catalog layout detail pages remain practice-only on this tab.
- Without custom text, each new lesson samples the configured number of distinct words from the
  selected vendored English word bank (English 1k by default; optional English 10k) (10, 25, or 50; default 10). The first remaining word is the active target.
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
  successful advance clears the field and contextual-input history and increments progress.
  Monkeytype, the default Test style, keeps completed words in their original positions. Colemak
  Club instead removes each completed word from the prompt. A premature space
  remains in the input and counts as an incorrect attempt without changing the rendered prompt
  text.
- The prompt and input use the same monospace typography and span the full panel width, matching
  Layout feel and Layout test area. Their shared size stays at the show-page scale during the
  lesson. The Colemak Club prompt stays on one line and leftover words are clipped rather than
  wrapped. The default Monkeytype test style gives the prompt and input a smaller matching type size, uses
  a correspondingly shorter input field, and wraps the full lesson across as many lines as needed.
  Depending on the available width and lesson, the prompt can still fit on one line. Pending text
  uses a muted, theme-aware gray; correct text uses the theme's high-contrast practice color; and
  incorrect text uses the theme's practice-error red. A separate purple practice caret sits
  immediately before the current target character and advances after every entered character,
  whether correct or incorrect. It sits after a complete non-final word while it awaits Space. It
  does not replace the Magic or Adaptive text-decoration underline when both apply to a character.
  Completion replaces the prompt with Accuracy and WPM. Colemak Club results shrink until they fit
  the available width; Monkeytype results retain the same smaller size as the prompt and input.
  Creator Edit and Preview keep the show-page prompt, input, and score scale, matching catalog
  layout detail pages. Edit replaces the presentation keyboard with the key editor and editable
  Magic/Adaptive panels; it does not shrink practice chrome.
- The input receives focus when Typing practice mounts. Quick Find explicitly hands focus to the
  input after navigating to a layout, including detail-to-detail navigation where the practice
  component is reused instead of remounted. For a random lesson, Escape replaces the lesson with a
  newly sampled set of the configured length that excludes every word from the previous lesson. For
  a custom lesson, Escape restores its original URL-backed words. Both paths reset input, progress,
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
- Layouts with AKLDB Magic mappings add a default-on Underline magic group option. It underlines
  each target substring that can be entered with a Magic key, including the preceding rule context
  and emitted characters. A Magic trigger with repeat-last fallback also underlines adjacent doubled
  letters within a word. The hints follow disabled mappings and use the resolver's longest-rule
  precedence. Magic underlines and Magic keycap fills use `--magic-key`; keycap glyphs use
  `--magic-key-fg` for contrast against that fill. Adaptive underlines, armed Adaptive keycaps, and
  swap-path strokes use `--adaptive-key`.
- Layouts with AKLDB Adaptive mappings similarly add a default-off Underline adaptive group
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
  315px. The keyboard and mappings share one centered wrapper. At intermediate widths the mappings
  column grows fluidly from 224px to that cap as room becomes available, switching to two mapping
  columns once it is wider than 256px. The keyboard derives its intrinsic width from the current
  board's actual row geometry and
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
- Completion replaces the prompt with Accuracy and WPM. Colemak Club results shrink to fit the
  available width, while Monkeytype results retain their smaller practice size.
  Accuracy is correct character attempts divided by
  all character attempts; deletions do not count as attempts. WPM uses the conventional
  five-character word and the lesson's completed characters, including inter-word spaces, over
  elapsed time.
- The completed input placeholder reads `Press ESC for more practice` and Escape immediately starts the next lesson.
- A settings button on the prompt opens the shared modal shell with the displayed lesson ready to
  edit. Typing practice also places a Test style segmented control in this modal, with Monkeytype
  as the default and Colemak Club as the alternative. It is staged until Save, while Cancel and the other dismissal paths discard
  the change. Layout feel omits that display setting and places its settings button on the remapped
  prompt row, not the quieter source-word line.
  Saving writes the chosen lesson to local storage and to the shareable `text` / `special` /
  `words` query, then starts that lesson. Reset restores random 10-word defaults and persists
  that choice. Explicit defaults such as `words=10` and `special=0` remain in the URL so they can
  temporarily override different stored prefs. Loading a page that already has lesson query params
  applies them only for that visit; they do not overwrite stored prefs until the user saves from the menu.
- Practice display options persist across layouts and reloads in the versioned
  `typingPracticeDisplayOptions` local-storage document. Lesson source prefs (custom text, special
  balance, and word count) persist in the separate versioned `typingPracticeLessonSettings`
  document. The current in-progress session remains page-session-only; navigating away or
  reloading starts a new lesson from stored prefs, or from URL overlays when those params are
  present. Typing practice and Layout feel share that page-session lesson. Switching away from an
  in-progress Practice or Feel test clears the timer, input, and progress, keeps every word that
  has not been entered correctly, and — for a random lesson — appends newly sampled words so the
  lesson is the configured length again (`0/10`, `0/25`, or `0/50`). An untouched lesson is left
  as-is so unused random text does not reshuffle. Custom `text` lessons keep their leftover words
  (or restore the full custom text when none remain) and do not add random words. Layout feel also
  reuses this same display-options document (including Feel-only `ignoreWrongKeyPresses`), but does
  not expose or apply the Typing-practice-only Test style option. Feel uses the
  same shareable `text` / `special` / `words` lesson query. See
  [`layout-detail-page.md`](./layout-detail-page.md) for Feel’s remapped matching model; do not
  treat Feel as a second live-resolve practice field.

## State and input boundaries

`src/lib/typingPractice.ts` is the pure domain layer. A `TypingPracticeSession` owns the stable
remaining-word queue, current input, completed count, and original total. Pure helpers sample
without replacement, update input, check exact completion, advance the queue, and derive
per-character feedback. Prompt derivation can additionally receive the original source words to
prepend completed-word feedback for the Monkeytype Typing practice display. Random selection accepts
an injectable source for deterministic tests. The
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

The layout-detail route owns canonical `tab`, `text`, `special`, and `words` query state and
resolves it over stored lesson prefs before passing the effective lesson down through
`LayoutExpandedView.svelte` to both Typing practice and Layout feel. URL fields that are present
are temporary overlays; menu Save writes both local storage and the URL.
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
- Custom-text, word-count, URL overlay, and lesson-pref persistence:
  `src/lib/typingPracticeText.ts`
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
- Results shrink-to-fit sizing: `src/lib/fitTextToWidth.ts`
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
  `tests/fitTextToWidth.test.ts`,
  `tests/layoutKeyReachability.test.ts`, `tests/layoutTestAreaPrefs.test.ts`
- Browser coverage: `tests/e2e/layout-detail-typing-practice.e2e.ts`,
  `tests/e2e/layout-detail-keyboard-preview.e2e.ts`, `tests/e2e/layout-detail-feel.e2e.ts`

## Invariants

- Non-final words require an exact active-word match followed by resolved Space; the final exact
  match advances immediately.
- The prompt queue, input field, progress count, and contextual history reset together on advance.
- Custom lesson resets reproduce the normalized URL text exactly; random lesson resets exclude the
  prior lesson words.
- Remaining words retain stable identities as the head of the queue is removed.
- The Colemak Club prompt and input share one fitted monospace size, and the prompt stays on a single
  clipped line. The default Monkeytype style changes the Typing practice prompt, input, and results
  to the same smaller type size, lets the full prompt wrap when needed, and adds theme-aware
  pending/correct/error colors plus an independent insertion caret before the current character or
  after a completed non-final word that is waiting for Space.
- Prompt correctness is derived from session state; DOM classes are not a second source of truth.
- The timer starts once, stops once, and result values remain frozen after completion.
- Layout test area keeps independent free-typing text and contextual history. Typing practice and
  Layout feel share the page-session source word pool and leftover lesson words. Leaving either
  tab during a test clears the timer, input, and progress and refills a random lesson to the
  configured word count. Each tab still keeps its own input encoding (live-resolve source text vs remapped feel
  labels) and Feel-only flash/ignore-wrong-key UI.
- Input-layout translation precedes Adaptive, Magic, and Repeat resolution and does not change the
  displayed target layout or its contextual profile.

## Expanded word bank

Test source offers a Word bank selector below Random words and Custom text. English 1k
remains the default; English 10k expands the candidates for remapping examples. Selection
is staged until Save, persisted with lesson settings, and shared through `bank=english10k`
(or explicit `bank=english1k` when returning to the default). Reset restores English 1k.
Custom text bypasses word-bank loading. Practice and Layout feel use the selected bank;
changing banks loads the new pool and starts a fresh lesson. Stale requests cannot replace
a newer selection.

`static/languages/english10k.json` contains Monkeytype's original English 10k payload (9,944 words) from
the same pinned commit as English 1k:
[english_10k.json](https://github.com/monkeytypegame/monkeytype/blob/d7eb4b76f3b3000199022ea52a52365b9346b8d0/frontend/static/languages/english_10k.json).

The word-bank selector displays a trailing chevron. Clicking the `english_1k` or `english_10k`
credit opens Practice lesson on Test source and focuses Word bank. The remapping settings tab
is labeled Special mappings.
