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
  scrolling, and the focusable select-only listbox keyboard model.
- `Tabs.svelte` owns tablist semantics, roving focus, automatic activation, panel relationships, and
  Arrow/Home/End navigation.
- `SegmentedControl.svelte` owns mutually exclusive radiogroup semantics and roving focus for
  presentation or analyzer choices that do not reveal a tabpanel.
- `ModalShell.svelte` owns dialog semantics, focus trapping and restoration, Escape/backdrop
  dismissal, scroll locking, ordinary targeted initial focus, and portal placement. Targeted modal
  focus must not use the temporary filter-jump highlight. `ModalHeader.svelte` provides the shared
  title and close-button chrome.
- `Tooltip.svelte` and `HoverPopup.svelte` own focus/hover disclosure, tooltip description linkage,
  Escape dismissal, and body portal placement.

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

The layout detail page uses `Tabs` for its Test area and Stats panels. Its canonical `tab` query
parameter owns the selected value across direct links, reloads, clicks, and automatic keyboard
activation; Test area is the fallback for missing or invalid values. The panels use layout-specific
ids so their tab relationships remain unique for every route.

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
