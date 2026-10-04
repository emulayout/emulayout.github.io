# Layout creator

AI implementation context for the in-progress layout creator: a dedicated page where people
draft layouts, try them with the same practice workspace as a catalog layout, and save those
drafts in the browser.

## Product model

### Native chiral keys

The creator's special-key buttons and mapping sections follow Magic, Adaptive, Chiral order.
Chiral keyboard fills, creator controls, and mapping checkboxes use a distinct teal palette
(`--chiral-key` / `--chiral-key-fg`), including read-only keyboard previews. The Chiral section
beside Magic and Adaptive edits one compact definition per trigger: same-hand
output, opposite-hand output, and exception characters. Either output can repeat the previous
character, emit one character, or type the trigger normally. Invalid definitions show validation
feedback; only the first valid definition per trigger applies. Hiding the panel does not disable
its mappings; each trigger has an enable checkbox.

Chirals follow the assigned hand of the previous emitted character, not the physical hand that
pressed its key. Unknown context, no preceding character, and exceptions type the trigger normally.
Hand lookup is rebuilt when keys move. Imported explicit hand assignments belong to physical slots.
Magic definitions on the same trigger take precedence. Outputs are not recursively interpreted.
Literal Space is allowed in trigger/output/exception fields and Spark keys; other whitespace is
not. Assign Space to a keyboard slot to give a Space trigger its hand (there is no assumed hand
for an unassigned spacebar). Mapping labels identify it as `Space`; the key editor shows `␣`.
Press Space in a field to enter the character, not the word "Space". Saves and shares preserve it.

Drafts, browser saves, backups, and share links retain native Spark chiral definitions and the
recoverable chiral editor draft in the versioned creator document. Catalog and Spark imports preserve native definitions rather than expanding
them into Magic lists. Existing saved expanded Magic definitions remain unchanged: their original
chiral intent cannot be recovered reliably.

Code: `chiralKeys.ts`, `creatorChiralMappings.ts`, `CreatorChiralMappingsPanel.svelte`, and the shared
creator URL/input-profile modules. See `adaptive-swaps-architecture.md` for runtime composition.

### Workspace

- The shared app bar includes **Discover** and **Create** choice-chip links to the right of the
  logo. Discover goes to `/` and stays current on layout show pages. Create goes to
  `/create?edit=1`.
  Idle links are muted text with no chip. Hover shows a neutral pill and primary text. The
  current route uses `aria-current="page"` with accent text on an accent-tinted pill. Below the
  `md` breakpoint the Emulayout wordmark is hidden and the home link keeps only the logo icon.
- `/create` replaces index or detail content while preserving the rest of the app bar, including
  Discover, Create, the Quick Find search field, Compare, help hints, theme controls, and the home
  link. Quick Find is a pill search control that opens the existing modal; the other action icons
  sit on the app-bar background and show a circular hover highlight.
- The page uses index-style view tabs, not detail-page section tabs. An unsaved canvas is the first
  tab, labeled with the live draft name. Each saved layout is an additional tab labeled with its
  stored name (the live name while that tab is active). Saving the unsaved canvas turns it into a
  saved tab. Switching tabs loads that layout's snapshot into the editor. When at least one saved
  layout exists, a `+ New layout` button sits on the far side of the tab bar and starts a new
  unsaved QWERTY canvas in Edit (`/create?edit=1`) without leaving `/create`. It is hidden while there are
  no saved layouts, because the unsaved canvas tab is already showing. A gear button follows it
  (and remains available when no layouts are saved) to open layout backup settings. Saved tabs
  include the same pointer X as index view tabs;
  Delete or Backspace on a focused saved tab opens the same style of confirmation. Deleting a
  saved layout removes it from local storage. Deleting the active layout starts a new canvas;
  deleting another tab leaves the current draft in place. The unsaved canvas tab has no delete
  control.
- The New layout canvas starts as Row stagger QWERTY named `New layout`. Opening that unsaved canvas
  in Edit focuses Layout name and selects the default name so it can be replaced immediately. Create,
  `+ New layout`, discarding dirty edits to start a new canvas, and deleting the active saved layout
  all take this path. Layout name and
  author name fields sit above Input layout. On a wide header they share the row equally; when
  that space is too narrow they stack. The name updates the live draft; an empty value falls back
  to `New layout`. Author is optional and stays empty until typed. The author field is a
  combobox over catalog authors: type to search, use the chevron for the full list, and keep a
  freeform name if it is not in the catalog. The document title and the
  active tab use the layout name. Renaming does not regenerate the practice words. Preview uses the
  same two-column show-page layout as `/layouts/[name]`: a summary card on the left and Typing
  practice, Layout test area, and Layout feel on the right. The card shows the live name and
  author. Local drafts have no analyzer stats, so the card uses the unavailable presentation with
  the subtitle `Local layouts have no analyzer stats.` There is no card analyzer selector, no Stats
  tab, and no akl.gg or Colemak Camp link. A Cyanophage link stays when it can be built from
  the live keymap.
- The current draft is the `/create` query string, using replace-state synchronization. Content
  uses one UTF-8 base64url `document` field containing the version-1 creator envelope:
  `{ version: 1, format: "spark/1", layout, emulayout }`. `layout` is validated Spark content;
  `emulayout` holds name, author, geometry, base selection, editor drafts and stable row/group ids,
  disabled mappings, and practice settings. The editor recovery sidecar currently includes the
  supported key and mapping projection; replacing that duplication is step 4 of the transition.
  Incomplete or invalid editor rows remain recoverable but do not enter executable Spark content.
  Multi-character fixed Magic fallbacks stay in the Emulayout sidecar because Spark defaults emit
  one character. They retain their existing runtime behavior.
  An unchanged default canvas omits `document`. Active saved layouts also write `id` (a local
  UUID); an unchanged saved layout uses `/create?id=<uuid>`. Dirty edits include `document`
  alongside `id`, so refresh retains them. `edit=1` and the Practice / Test / Feel `tab` remain
  separate view state and do not count as saveable changes. Preview and Typing practice are the
  omitted defaults; invalid or `stats` tabs become Typing practice. Explicit lesson query options
  can overlay document settings for the current visit.
  Writes wait 300ms after the last edit and flush on page hide. Create and **+ New layout** open
  a fresh Edit canvas (`/create?edit=1`); bare `/create` opens the default Preview.
  Catalog **Edit layout** links use the document transport to seed an unsaved canvas named
  `New layout`. Old links with a `base` without keys still seed once the catalog loads. Readers
  retain old name, author, geometry, keys, Magic, Adaptive,
  Chiral, disabled-mapping, and lesson codecs, including `keys=v1:-` for an empty board.
  Malformed, oversized (over 1 MiB encoded), or future-version documents restore a default canvas
  rather than reading unrelated legacy fields. Do not put document payloads, names, saved ids,
  key maps, or lesson text into GoatCounter paths or events.
- Share, Edit/Lock, Duplicate, and save stack under the summary card in the left column.
  **Share** is immediately before **Edit** in Preview and immediately before **Lock** in Edit.
  **Lock** is hidden on an unsaved canvas. **Save** appears on that canvas while it differs from the
  default snapshot; **Save changes** appears only while a saved layout has unsaved changes. Share copies an absolute `/create` URL containing the normalized
  content snapshot: layout name, author, keyboard geometry and keys, Magic and Adaptive drafts,
  disabled mappings, and practice settings. It never includes a browser-local saved-layout `id`
  or transient Edit/Preview/detail-tab state. The link uses `share=2` to distinguish a portable
  layout offer from an ordinary creator draft URL. Legacy `share=1` links remain readable;
  malformed or future document offers are not opened.
- Opening a `share=2` creator URL does not apply the payload to the live canvas. It opens a
  **Shared layout** modal with an editable Layout name, read-only author, presentation keyboard,
  and read-only compiled Magic/Adaptive mappings. The share query stays intact while the offer is
  open, then is replaced by the current creator URL when the modal closes. Cancel discards the
  offer without writing local storage. **Save layout** creates a new local saved-layout tab under
  the possibly edited name, opens it in Preview, and writes its local `id` URL. Invalid or
  incomplete mapping rows remain in the portable payload and local snapshot even though only
  complete mappings appear in the read-only preview.
- In Edit, the typing-practice keyboard slot shows the editable key editor instead of the
  presentation preview. Base layout (optional) and keyboard geometry sit above that editor. Choosing a
  catalog layout seeds the key grid and that layout's default Magic and Adaptive mappings while
  preserving the creator's current keyboard geometry; catalog layouts are geometry-neutral. Empty slots stay optional, so a draft may use fewer or more assigned characters than
  the base. The editor keeps the full QWERTY slot grid and sizes that grid to the page, so unused
  punctuation columns do not overflow. Printable keys replace the focused slot and advance,
  Backspace/Delete clear, and arrows move among slots. The **Import** button beside Base layout
  opens a modal with a multiline Layout keys field. It accepts plain rows, bracketed rows, and
  Markdown-linked `[row](url)` text, with whitespace between keys. Imported rows start at the
  keyboard's left edge; every imported row clears its unfilled trailing slots, while rows omitted
  from the import stay unchanged. Typing or importing `@` or `*` adds that trigger to Magic
  mappings when it is not already present, and turns Magic on. `@` starts as fallback-only (otherwise → repeat previous),
  with no empty mapping row; Add mapping still adds rows. `*` uses the empty Magic section. If Magic
  is still unused and the first typed trigger is `@`, the placeholder `*` section is omitted.
  Clearing `@` or `*` from a slot does not remove its mapping.
  Import also offers **Spark schema/1** for pasted JSON: either a raw object with `keys` and
  optional `magic`, or the version-1 `spark/1` AKL wrapper. The existing AKL importer handles
  conversion through the shared Spark validator/compiler and reports omissions before Import.
  Malformed known fields reject the whole import; valid but unsupported content produces warnings.
  The original Spark document survives draft URLs, browser saves, backups, and shares. Targeted
  edits reconcile the supported projection while preserving unrelated source content, extension
  fields, and original finger assignments (see `spark-transition.md`). Invalid JSON, unsupported versions, no usable
  keys, and inputs over 64 KiB cannot be applied. Spark replaces all draft keys and mappings,
  clearing prior disabled mappings; it preserves practice settings, the active typing section,
  and the saved-layout identity without writing saved storage. Raw objects retain the current
  name, author, and geometry; wrappers supply them. The result stays in Edit and persists through
  ordinary draft URL/save/share behavior. Cancel changes nothing.
  Keyboard geometry is Row stagger or Column stagger, matching the index toolbar. Thumb keys use the same left/right
  separation as the presentation keyboard, with an empty spacebar-sized gap
  between hands, including when both thumbs emit the same character. Assigned values may repeat and stay on
  their own slots, so several keys can output the same character. Empty slots are omitted from the
  live draft. Edits update the in-memory layout immediately so every Edit typing tab uses the
  current keys. The same workspace options paint that editor: next-key outline, home-key coloring,
  special-key fills and emitted values (Magic sparkles on mapped triggers, the Repeat glyph on `@`
  when it is Repeat or repeat-last-only), Adaptive swap paths, and unreachable slashes. While a key
  field is focused, the typed value stays visible instead of the contextual overlay.
- Preview keeps `LayoutExpandedView` in local-preview mode and shows the summary card. The card
  and right-hand tabs match the catalog show page, except stats stay unavailable, the card analyzer
  selector and Stats tab are omitted, and the akl.gg and Colemak Camp links are hidden. Edit keeps that same
  two-column show-page layout and summary card. It replaces the presentation keyboard with the
  key editor and shows editable Magic/Adaptive panels instead of the read-only mapping panel. The
  preview keyboard still
  draws the 10 keys on each letter row and empty keycaps for unassigned slots between letters so
  remaining keys keep their physical columns. The key editor, name and author fields, base-layout
  and keyboard-geometry fields, special-key add buttons, missing-letter warning,
  and editable mapping panels are hidden until Edit again. The catalog mapping panel still appears
  in the practice workspace when the draft has complete Magic or Adaptive mappings, even if those
  editors were closed in Edit. Those summary-column actions show **Share**, then **Lock**, while
  editing a saved layout, and **Save** or **Save changes** only when the canvas differs from its
  saved or default snapshot. **Lock** is omitted until the layout has been saved and returns the
  page to view-only. They show **Share**, then **Edit**, while previewing.
  **Edit** focuses the first editable key, not Layout name or a practice field.
- While in Edit, Magic and Adaptive add buttons sit to the right of the keyboard in their
  own column, top-aligned with the first keyboard row. Either or both can be on. Magic opens the
  mapping editor without adding a key to the board; Adaptive sets the draft's adaptive-swap flag.
  Typing `@` or `*` into a slot still adds that trigger and turns Magic on.
  Clicking an active button hides that editor without discarding the draft. The icon fill lights up
  when that feature is on and at least one complete mapping is enabled. Closing the editor while
  complete mappings remain tints the icon and label in the Magic or Adaptive color so the saved data
  is still visible.
  Panel visibility is transient UI state, separate from the persisted feature flags and mapping
  drafts. Reopening Magic or Adaptive restores the same data; hiding a panel never removes its URL
  or saved-layout payload.
- When a special key is on, its mapping editor appears in a separate column to the right of those
  buttons. Opening a panel does not move the icon column. Magic and Adaptive never share a panel.
  Each panel can add, edit, and delete mappings,
  add or delete labeled sections (Magic: extra triggers; Adaptive: schema groups), and temporarily
  disable complete mappings with the same checkboxes as the catalog selectors. Those enabled and
  disabled states are part of the draft: they stay in the URL, count as a saveable change, and
  restore with a saved layout. Each Magic section
  also has the schema fallback: nothing (`no-op` / omitted), repeat previous, or fixed text. Fixed
  text stacks under the fallback selector in the same field column. Rule and fallback rows share
  columns so the trigger and output line up; the preceding field fills the space before the trigger.
  A trigger can live on an emitting
  fallback alone. Incomplete rows stay in the draft and are omitted from the live practice profile.
  A caution warning sits under the keyboard, before the workspace options. It lists A–Z letters
  missing from the keyboard. A Magic emit or emit fallback can cover a missing letter only when
  that trigger is on the board and the mapping is enabled. Mapping keys that are not letters,
  including a missing Magic trigger, are not listed. The key list wraps inside the keyboard width
  so a long set of missing letters does not scroll the page sideways. The warning is Edit-only.
- Edit and Preview share the show-page **Layout detail sections** tabs: Typing practice, Layout
  test area, and Layout feel. There is no Stats tab. The selected tab is the `tab` query
  parameter, matching catalog show pages, so a refresh or shared `/create` link keeps it.
  Toggling Preview/Edit keeps the selected tab. Opening a saved layout, a new
  canvas, or a duplicate resets to Typing practice. In Edit, every section keeps the key editor,
  name and author fields, base-layout and keyboard-geometry fields, special-key add buttons,
  missing-letter warning, and editable mapping panels, so the user can test the live draft in
  Typing practice, Layout test area, or Layout feel. Typing practice and Layout feel share the
  page-session leftover lesson words; leaving either tab during a test refills a random lesson to
  the configured word count and clears the timer. Layout test area keeps its own free-typing surface.
  Each tab still uses its own keyboard options. Preview swaps that editor for the presentation keyboard.
  Edit Practice and Feel keep the show-page prompt, input, and score scale. Their typing fields do
  not autofocus in Edit, so loading the editor cannot steal focus from a layout field. Layout test
  area keeps the tall free-typing surface in both views. The same
  Practice lesson settings control as the detail page
  can replace that lesson with custom `text`, raise the remapping word share with
  `special`, adjust relative Magic/Adaptive/Chiral weights with `remap`, or set random-lesson
  `words` to 10, 25, or 50. Weights and combined/split mode also survive saved layouts, shares,
  and backups through the document sidecar. Menu Save persists those choices and
  writes them to the creator query; loading a URL that already has those params applies them only
  for that visit. Untouched defaults are omitted; defaults explicitly saved from the menu remain
  query overlays so they can override different stored prefs. Magic and
  Adaptive mapping controls appear when the draft has those features, using the same workspace as
  the detail page.
- Creator visits use document scrolling at every viewport width, matching layout detail pages.
- Direct `/create` links are first-class. The route is prerendered so GitHub Pages can serve it
  without relying on the SPA fallback.
- `/try#akl=<payload>` is the stable akl.gg handoff route. The payload is compact wrapper JSON
  encoded as UTF-8 and then unpadded RFC 4648 base64url. The route consumes a version-1 `spark/1`
  wrapper entirely in the browser, immediately removes the fragment, and opens the imported layout
  as an unsaved Preview. Percent-encoded JSON and other transport encodings are not accepted. The
  wrapper supplies name, optional author, board type, and optional source URL. Spark rows 0–4
  and columns 0–12 are accepted; out-of-bounds keys are omitted and reported before rendering.
  Encoded payloads over 64 KiB are rejected. Free keys, duplicate characters, thumb hands, Magic keys (including
  multi-character contexts, fallbacks, and exceptions), chiral keys, representable raw rules, and
  Adaptive swaps are imported. The number row and custom non-thumb finger assignments are not
  represented by the creator; a status notice names omitted data. Raw rules that rewrite or delete
  earlier text are also omitted from execution; they remain in the canonical document. Whitespace-context rules use
  literal preceding-text matches. Whitespace is preserved in these contexts; the runtime does not
  synthesize Spark's initial word boundary.
  Imported raw and chiral triggers retain their base output outside matching contexts, including
  chiral exceptions. Explicit Magic defaults keep their declared behavior.
  The first occurrence of a duplicate character is marked `primary` on the key configuration;
  the editor sidecar preserves this marker while Spark ordering preserves the primary slot through
  sorting, reload, sharing, and saved-layout storage. Changing that key's value clears the marker.
  `/try` uses the same document scrolling and current Create navigation state as `/create`.
  Invalid base64url or UTF-8, invalid JSON, an unknown wrapper
  version or format, or a payload with no usable keys opens the normal creator and reports
  `Couldn't read this akl.gg link.` Optional unknown wrapper fields are ignored. After import, the
  creator's ordinary URL synchronization keeps the draft reloadable without re-reading the hash.
- Saved layouts persist only layout and lesson content in a versioned local-storage document, each
  with its own id; Preview/Edit mode and the selected detail tab remain URL view state. Share,
  **Edit** / **Lock**, Duplicate, and save stack under the summary card while the page document-scrolls.
  Save follows the live canvas: **Save** only when an unsaved draft has changed, with **Clear all
  keys** below it and no **Lock** control; a split **Save changes** with
  **Save as new layout** when a saved layout has changed, plus **Undo changes** below
  that split; **Duplicate layout** only when a saved layout matches its stored snapshot. Duplicate
  saves a new copy, opens it in Edit, and advances a trailing copy number until its name is unused:
  `My layout` becomes `My layout 2`, `Vylet v5` becomes `Vylet v5 2`, and `Test 3` becomes `Test 4`.
  Switching saved tabs or starting a new canvas asks for confirmation when the current layout has
  unsaved content; Preview/Edit and detail-tab changes do not count. Deleting the active dirty
  layout includes the same discard warning in its delete confirmation. Undo restores the
  stored snapshot and keeps the current Preview/Edit mode. It is hidden on an unsaved canvas and
  while a saved layout is clean. Save and save-as-new use the current layout name. A save is only acknowledged after local storage confirms the write. If storage is
  unavailable, the creator keeps the full draft URL and shows a recoverable error instead of
  switching to an id-only URL. Open creator tabs synchronize saved-layout changes, and writes merge
  stable ids so one tab does not discard layouts saved by another. They do not send analytics events.
  **Clear all keys** is available only on the unsaved canvas. It blanks the key grid, clears the
  selected base layout, and removes all Magic and Adaptive rules while preserving the name, author,
  keyboard geometry, and practice lesson. It is disabled when those key and mapping fields are already
  empty. Saved-layout storage version 3 stores each entry's creator `document` directly with its
  local id, name, and creation time. Version 1 and 2 query-string snapshots remain readable and
  migrate on the next successful save or backup export; local ids and ordering are retained.
  Version 1 entries without explicit keys restore the QWERTY board. Malformed version-3 entries
  are skipped rather than falling back to legacy queries.
- **Layout backup settings** mirrors the custom-view backup UI. It opens on **Export layouts**,
  where any subset of saved layouts can be copied as versioned JSON or downloaded as
  `emulayout-layouts-YYYY-MM-DD.json`. **Import layouts** accepts pasted JSON or a `.json` file,
  validates each entry, allows selecting a subset, and can either add to the local collection or
  replace it. Add mode refreshes case-insensitive name or id matches while retaining the matching
  local id so existing creator URLs stay valid. Invalid entries are skipped and reported. Replacing
  a collection never discards the live canvas: a dirty active saved layout becomes an unsaved URL
  draft if its stored entry is removed, while a clean removed layout returns to the default canvas.
  Failed persistence leaves both the current draft and stored collection unchanged.

## Deferred work

- Repeat mapping editors.
- Renaming saved drafts from the tab bar.

## Code map

- Default canvas, tab values, duplicate names, and key-editor conversion: `src/lib/layoutCreator.ts`
- Versioned Spark document builder, edit reconciliation, validation, and content signatures:
  `src/lib/creatorDocument.ts`; stable draft ids: `src/lib/creatorDraftId.ts`
- Shareable `/create` document transport and legacy query reader: `src/lib/layoutCreatorUrl.ts`
- akl.gg `spark/1` handoff parsing and adaptation: `src/lib/aklTryImport.ts`,
  `src/routes/try/+page.svelte`
- Shared Spark types and structural validation: `src/lib/sparkSchema.ts`; supported-subset
  compilation and diagnostics: `src/lib/sparkCompiler.ts`; foundation tests: `tests/spark.test.ts`
- Saved-layout local-storage document and session restore: `src/lib/layoutCreatorStorage.ts`
  (`resolveCreatorSession`, `snapshotForSavedLayoutView`)
- Saved-layout backup parsing and merge rules: `src/lib/savedLayoutsBackup.ts`
- Draft Magic/Adaptive mapping sources, catalog seeding, and compilation: `src/lib/layoutCreatorMappings.ts`
- Catalog layouts and supplemental mappings: `src/lib/layoutsCatalog.svelte.ts`
- Creator page chrome, live key editor, and practice workspace: `src/lib/components/LayoutCreator.svelte`
- Shared string autocomplete and domain adapters: `src/lib/components/TextAutocomplete.svelte`,
  `src/lib/components/LayoutAutocomplete.svelte`,
  `src/lib/components/AuthorAutocomplete.svelte`
- Catalog author lookup and Discover author-filter query: `src/lib/layoutDetails.ts`
  (`resolveAuthorByName`), `src/lib/filterUrlCodec.ts` (`authorFilterIndexSearch`)
- Saved-layout delete and dirty-navigation confirmations:
  `src/lib/components/DeleteSavedLayoutModal.svelte`,
  `src/lib/components/DiscardCreatorChangesModal.svelte`
- Layout backup gear and modal: `src/lib/components/LayoutBackupsMenu.svelte`; shared custom-view
  and layout backup panels: `src/lib/components/BackupImportPanel.svelte`,
  `src/lib/components/BackupExportPanel.svelte`
- Editable mapping panels: `src/lib/components/CreatorMagicMappingsPanel.svelte`,
  `src/lib/components/CreatorAdaptiveMappingsPanel.svelte`
- Route: `src/routes/create/+page.svelte`, `src/routes/create/+page.ts`
- App-bar Discover and Create links and document-scroll shell: `src/routes/+layout.svelte`
- Reused practice session and keyboard workspace: `src/lib/components/LayoutTypingPractice.svelte`,
  `src/lib/components/LayoutKeyboardWorkspace.svelte`
- Show-page preview and shared creator tabs: `src/lib/components/LayoutExpandedView.svelte`
  (`localPreview`, optional `summaryFooter` and Edit keyboard snippets; Edit keeps the show-page
  summary column)
- Preview letter-row and gap-key fill: `src/lib/layoutDisplay.ts` (`fillPreviewKeyboardRows`)
- Shared keyboard option presentation and swap-path measurement:
  `src/lib/layoutKeyboardFeedback.ts` (`LayoutKeyboardPresentation`),
  `src/lib/layoutKeyboardSwapPathLayer.ts`
- Pageview sanitization: `src/lib/goatcounter.ts`
- Unit coverage: `tests/layoutCreator.test.ts`, `tests/layoutCreatorMappings.test.ts`,
  `tests/layoutCreatorUrl.test.ts`, `tests/layoutCreatorStorage.test.ts`, `tests/creatorDocument.test.ts`,
  `tests/layoutDisplay.test.ts`, `tests/goatcounter.test.ts`
- Browser coverage: `tests/e2e/layout-creator.e2e.ts`

## Invariants

- The app remains client-only (`ssr = false`). `/create` is prerendered alongside the index.
- Discover and Create are links, not modals, and stay available from every route.
- Creator tabs use the shared `Tabs` primitive with automatic Arrow/Home/End activation and a
  labelled tab/tabpanel pair. `+ New layout` is a button beside the tablist, not a tab, and only
  appears when a saved layout exists. Layout backup settings is an adjacent dialog button and stays
  available with an empty collection so a backup can be restored on a fresh browser.
- GoatCounter counts `/create` as a coarse page class titled `Layout creator`. Do not send draft
  names, author names, key maps, lesson text, or WPM.
- A copied `/create` query restores the draft. Create and `+ New layout` open Edit
  (`/create?edit=1`). A show-page **Edit layout** link opens that Edit canvas with the shown layout
  as the selected base. A bare `/create` link opens Preview of the default canvas. Saved-layout tabs
  come from local storage; `id` in the query selects one when it exists.
