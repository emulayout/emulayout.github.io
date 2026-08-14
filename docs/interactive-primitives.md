# Internal interactive UI primitives

The app owns a small set of Svelte components for common interactive behavior. These components
provide semantics, keyboard handling, focus management, and dismissal behavior while consumers
retain domain-specific markup and styling.

## Primitive map

- `AccordionSection.svelte` owns accordion triggers, expanded state semantics, panel relationships,
  active indicators, and optional reset actions.
- `DropdownMenu.svelte` owns menu-button relationships, initial item focus, Arrow/Home/End
  navigation, Escape focus restoration, focus-out dismissal, and outside-pointer dismissal.
- `Listbox.svelte` owns option semantics, stable active-descendant ids, pointer highlighting,
  scrolling, and the focusable select-only listbox keyboard model. `onSelect` receives the
  originating mouse or keyboard event so consumers can honor modified activation, such as Quick
  Find opening a layout in a new tab on Cmd/Ctrl.
- `Tabs.svelte` owns tablist semantics, roving focus, automatic activation, panel relationships, and
  Arrow/Home/End navigation.
- `SegmentedControl.svelte` owns mutually exclusive radiogroup semantics and roving focus for
  presentation or analyzer choices that do not reveal a tabpanel.
- `ToggleSwitch.svelte` provides the shared labeled switch semantics, focus treatment, and visual
  state for independent boolean display options.
- `ModalShell.svelte` owns dialog semantics, focus trapping and restoration, Escape/backdrop
  dismissal, scroll locking, ordinary targeted initial focus, and portal placement. Targeted modal
  focus must not use the temporary filter-jump highlight. `ModalHeader.svelte` provides the shared
  title and close-button chrome.
- `Tooltip.svelte` and `HoverPopup.svelte` own focus/hover disclosure, tooltip description linkage,
  Escape dismissal, and body portal placement. Help triggers normally follow the global hint
  preference; a consumer may keep essential interaction guidance available with `alwaysVisible`.

`portalToBody.ts`, `listboxNavigation.ts`, and `segmentedControl.ts` contain small reusable behavior
helpers used by these components.

## Listbox focus models

Editable comboboxes keep DOM focus in their text input and point `aria-activedescendant` at the
active `Listbox` option. Their options are pointer-selectable but not separate Tab stops. Arrow Up
and Arrow Down change the active result; Home and End retain their native text-caret behavior.
The active option must have a visible focus treatment distinct from selection, including when the
active option is already selected.

Select-only popups focus the listbox itself. In that mode, Arrow Up/Down, Home, and End move the
active option, Enter or Space selects it, and Escape closes the popup and restores its trigger.

Do not place an independently focusable control inside a `role="option"`. Render the option itself
as the interactive element using the props supplied by `Listbox`.

## Tabs and segmented controls

Use `Tabs` only when choices reveal or replace a tabpanel. Each option must identify its controlled
panel. Tabs use automatic activation: moving focus with an arrow also selects the destination tab.

Use `SegmentedControl` for mutually exclusive settings that change presentation or select a mode
without a tabpanel. It uses radiogroup/radio semantics. Both primitives leave the selected option as
the sole Tab stop and fall back to the first option if persisted runtime state is invalid.

The Settings modal uses `Tabs` to switch among its Display settings, Import views, and Export views
panels. Each tab owns one persistent panel id so arrow-key navigation and ARIA relationships remain
consistent as the panel content changes. A successful view import resets the import form, restores
focus to the backup text field, and announces completion in a short-lived polite-status snackbar.

The layout detail page uses `Tabs` for its Typing practice, Layout test area, Layout feel, and Stats
panels. Its canonical `tab` query parameter owns the selected value across direct links, reloads,
clicks, and automatic keyboard activation; Typing practice is the fallback for missing or invalid
values. The panels use layout-specific ids so their tab relationships remain unique for every route.
When help hints are on, Layout feel paints a decorative `?` on its tab and uses the tab’s `title`
for the short explanation; do not put a focusable `Tooltip` button inside the tablist.

The layout creator uses the same `Tabs` primitive as the index layout-view bar: an unsaved canvas
tab, labeled with the draft name, plus a tab for each saved layout. Those tabs reveal the creator
canvas rather than detail sections. See [`layout-creator.md`](./layout-creator.md).

Typing practice uses `ModalShell` and `ModalHeader` for its custom-text editor. Layout feel reuses
that same modal; saving keeps the current detail tab (`feel` or `practice`) while writing `text` /
`special`. The trailing pencil opens the modal with the displayed lesson selected as the editable
source; Cancel, the header close button, Escape, and backdrop dismissal restore focus to that
pencil. Saving replaces the prompt via the route's shareable `text` query parameter.

The reusable input-layout control also uses `ModalShell` and `ModalHeader`. Its base-layout field
uses the shared `LayoutAutocomplete` listbox over the lazily loaded catalog. The keyboard editor
owns arrow-key navigation among its text fields: Left and Right cross row boundaries, Up and Down
select the nearest key in the adjacent row, and entering one printable key advances to the next
field. The modal validates a unique effective source-key map before Save and restores focus to its
trigger on every dismissal path.

The layout creator replaces the practice keyboard preview with that same key editor, plus the
base-layout autocomplete and keyboard-type control, in the keyboard slot. It hides QWERTY
placeholders and does not require unique assigned values, so a draft may keep any number of
letters, including repeats. Empty slots are dropped from the live draft. A later lock control will
swap this editor for the presentation-only preview.

`LayoutAutocomplete` exposes its listbox affordance with a focusable trailing chevron. Its first
focus stays closed, typing opens ranked search matches, and the chevron toggles a default
alphabetical list with the committed selection first. Refocusing after leaving the field also opens
that default list. Selection closes the list but retains input focus. Consumers that supply
`onClear` get a separate trailing clear button; clearing retains focus with the list closed. Its
optional loading state renders an accessible spinner in the trailing field controls without adding
content below the field or changing the consumer's layout.

## Invariants

- Interactive consumers pass state down and receive changes through callbacks; primitives do not
  mutate domain state directly.
- Escape restores focus to the disclosure trigger when the interaction stays within the same UI
  flow.
- Editable inputs keep native text-editing keys unless the associated ARIA pattern explicitly owns
  them.
- Visible labels and accessible names use the same sentence-case wording unless assistive
  technology needs extra context.
- Consumer-specific styles remain scoped under a local wrapper when a class is applied inside a
  child primitive.
- Add focused unit coverage for extracted behavior helpers and Playwright coverage for rendered
  keyboard/focus behavior.
