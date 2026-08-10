# Repository guidance

## Project conventions

- Use Bun for package management and scripts. Do not introduce npm, pnpm, or Yarn commands or lockfiles.
- This project uses Svelte 5, SvelteKit 2, strict TypeScript, and a client-only static-site architecture.
- Preserve `ssr = false` in `src/routes/+layout.ts` unless the task explicitly changes the rendering architecture.
- Keep changes focused. Follow nearby naming, typing, component, and test patterns before introducing a new abstraction or dependency.
- Put reusable domain logic in `src/lib/*.ts`; keep Svelte components focused on rendering and interaction. Shared rune-based state belongs in a `.svelte.ts` module.
- Use `$lib` imports for modules under `src/lib` when practical and generated SvelteKit types such as `PageLoad` for route modules.

## Svelte and SvelteKit

- Write new reactive code with Svelte 5 runes. Prefer `$derived` for values computed from state; reserve `$effect` for synchronization with external systems or browser APIs, and clean up listeners, timers, and subscriptions.
- Keep state ownership clear. Pass data down through typed props and changes up through callbacks; do not mutate a value owned by another component unless the API deliberately exposes bindable state.
- Use semantic HTML first. Preserve keyboard access, focus behavior, labels, ARIA relationships, and reduced-motion behavior when changing UI.
- Key `{#each}` blocks when item identity matters. Do not use an array index as identity for a reorderable or filtered collection.
- Use SvelteKit `load` functions and their provided `fetch` for route data. Run independent requests concurrently and represent shareable filter/navigation state in the URL.
- Guard browser-only APIs when code could run during module evaluation or tests, even though the app currently disables SSR.
- Avoid legacy Svelte syntax in new code when the repository already uses the Svelte 5 equivalent.

## UI and product copy

- Use sentence case for user-visible form labels, control text, menu items, and page, section, and modal titles.
- Preserve intentional capitalization for proper nouns, layout names, analyzer names, acronyms, and canonical metric labels.
- Keep visible labels concise and use the same wording for their accessible names unless extra context is needed for assistive technology.
- Match existing spacing, typography, color, responsive, and interaction patterns before adding a new visual convention.

## Feature documentation

- Before changing a documented feature, read its document and preserve the stated product model and invariants. Update the document when behavior or architecture changes materially.
- `docs/finger-workload-filter.md` covers finger-workload ranking, filtering, persistence, UI behavior, and its code map.
- `docs/layout-card-stats.md` covers stats display modes, card and Quick Find interactions, data loading, and fixed display invariants.
- `docs/interactive-primitives.md` covers shared interactive primitives, keyboard and focus models, ARIA contracts, and their consumers. Read it before changing shared accordions, menus, listboxes, tabs, segmented controls, modals, tooltips, or portal behavior. Update it whenever one of these primitives is added, removed, or materially changes its API or behavior.
- `docs/magic-keys-architecture.md` covers Magic-key and Repeat-key metadata, runtime behavior, composition, filtering, and analyzer boundaries.
- `docs/adaptive-swaps-architecture.md` covers contextual input data ownership, source formats, runtime resolution, UI boundaries, and deferred work.
- `docs/layout-supplemental-data.md` covers the curated `data/layouts/<layout>.json` format: open `meta`, mapping variants, staleness, validation strictness, and the published payload. Read it before changing curated layout data, its validation, or its wire format.
- `docs/analytics.md` covers GoatCounter pageviews and feature events, privacy invariants, and the code map. Read it before adding or changing analytics. Do not send layout names, typed values, lesson text, or other personal data.

## Testing tools and patterns

- Unit tests use Bun's test runner and live in `tests/*.test.ts`. Import from `bun:test`; prefer focused tests of extracted domain logic and run one file with `bun test tests/<name>.test.ts` while iterating.
- Browser tests use Playwright and live in `tests/e2e/**/*.e2e.ts`. Import the shared `test` and `expect` fixtures from `tests/e2e/fixtures/test.ts` so catalog requests stay deterministic.
- Do not add integration or end-to-end coverage for every small change. Low-risk styling tweaks and other changes that are unlikely to regress do not need dedicated tests.
- Reserve Playwright end-to-end tests for core user flows and behavior whose correctness depends on the rendered UI, browser APIs, routing, focus/keyboard handling, or interactions spanning multiple components.
- Prefer role-, label-, and accessible-name-based Playwright locators. Assert user-visible behavior, URL persistence, keyboard/focus behavior, and accessibility state rather than component internals.
- `bun run check` runs `svelte-check` and TypeScript validation. `bun run lint` runs Prettier in check mode followed by ESLint.
- There is no separate DOM/component-test framework. Keep pure behavior in unit-testable modules.

## Required verification

- After changing any tracked file, run `bun run lint` before handing work back. If formatting fails, format only the changed files, then rerun the full lint command.
- After changing Svelte or TypeScript code, also run `bun run check`.
- After changing behavior, run `bun test`; add or update a focused test when practical.
- Run a focused Playwright test while iterating and `bun run test:e2e` before handoff for changes to critical user flows, routing, focus/keyboard behavior, or interactions spanning multiple components.
- Run `bun run validate:mappings` after editing files under `data/layouts/`.
- Do not claim a check passed unless it was run successfully. If a required check cannot run, report the command and the blocker explicitly.

## Generated data and repository hygiene

- Do not hand-edit generated `static/*.json` catalog or analyzer data. Use the documented sync scripts when regeneration is required.
- Do not commit caches, generated analyzer data, build output, or unrelated formatting changes.
- Preserve existing user changes and avoid destructive Git operations.
