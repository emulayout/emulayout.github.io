# Spark transition

## Objective

Use Spark schema/1 as the canonical layout content, with one validator and compiler.
Keep editor state, app preferences, compiled lookup tables, and analyzer adapters separate.
The aim is fewer competing representations, not making every UI component interpret raw JSON.

## Current inventory

| Area                      | Current format                                   | Direction                                          |
| ------------------------- | ------------------------------------------------ | -------------------------------------------------- |
| AKL ingestion             | Spark plus analyzer-only Mana2 projection        | Shared Spark validation                            |
| Links / pasted imports    | Spark retained with supported editor projection  | Shared compilation, then a temporary draft adapter |
| Catalog geometry          | Compact positional arrays and feature flags      | Retain delivery optimization initially             |
| Catalog behavior          | Preserved Spark documents compiled on the client | Complete in step 2                                 |
| Creator                   | Canonical Spark with sparse editor recovery      | Complete in step 4                                 |
| URLs                      | Versioned Spark-plus-Emulayout document          | Complete in step 3                                 |
| Saves / backups           | Versioned creator documents                      | Complete in step 3                                 |
| Runtime                   | Compiled profiles and maps                       | Retain as derived data                             |
| Lessons / filters / stats | App settings and analyzer artifacts              | Keep outside Spark                                 |

Catalog behavior and imports now share Spark compilation. Mana2 remains an analyzer adapter,
not an alternative source of executable client behavior. Catalog readers accept Spark documents only; the previous supplemental schema, variants, shorthand,
and staleness metadata are retired. The existing sidecar filename remains a delivery detail.

Creator cloning and normalization use a common document builder rather than URL codecs.
The creator owns a Spark document with sparse editor recovery; geometry is built directly from
Spark keys. Compact catalog geometry remains a delivery format, independent of creator editing.

## Code size and constraints

The original audit identified a 738-line creator URL codec, 258-line supplemental validator, and
multiple source/draft/runtime conversions. Its estimate of 500–1,000 fewer production lines was
not achieved: preserving Spark source, unfinished editor work, and older personal data added
recovery and migration code. Catalog retirement and the unused URL-writer removal reduce code;
module extraction primarily clarifies ownership. Measure actual reductions rather than treating
the original estimate as a target. Tests, validation, and runtime logic remain necessary.

Preserve incomplete editor rows, stable UI identities, grouping, disabled mappings, base-layout
selection, lesson settings, and view state outside valid Spark content. Keep Emulayout's
multi-character fixed fallbacks in the editor sidecar; Spark defaults emit one character. Do not drop unsupported raw
rewrites, whitespace contexts, finger assignments, or extension fields from the canonical document.
Compiling a supported subset is distinct from validating or storing the source.

## Phases and stop gates

1. **Shared foundation — complete (2026-10-02).** Add shared Spark types, structural validation, and a
   compiler targeting the existing runtime. Reuse validation in ingestion and imports; route imports
   through the compiler and a thin creator adapter. Preserve the validated document separately from
   executable output and report unsupported capabilities. Test non-mutation, semantic parity, and
   malformed input. No storage or catalog-output migration.
2. **Catalog behavior — complete (2026-10-04).** Publish preserved Spark documents and compile
   catalog behavior with the shared compiler. Mana2 expansion is analyzer-only. Old supplemental
   generation is removed; its reader stays until the compatibility phase.
3. **Persistence and sharing — complete (2026-10-04).** Store and transport a versioned
   Spark-plus-Emulayout document. Preserve source content and incomplete editor drafts; retain
   legacy URL/share/storage readers.
4. **Editor and geometry — complete (2026-10-08).** Own Spark content with separate editor
   recovery; build key maps directly instead of routing through compact transport.
5. **Compatibility retirement — catalog cleanup complete (2026-10-08).** Retire the old generated
   supplemental format, unused variant helpers, and unused legacy URL writer. Keep old creator documents, saves, backups,
   shares, and URLs readable; further removal of user-content readers requires a separate decision.

**Authorization: steps 1–4 and the step-5 catalog and unused-writer cleanup are authorized and complete.
Retiring user-content compatibility is outside this cleanup.**

Post-transition module organization is authorized: separate content from URL transport, isolate
the legacy query reader, and separate document editing from validation. Session-state extraction
is complete; consolidation of repeated projections remains follow-up work.

## Step 1 boundaries (historical)

- Structural validation is shared; caller-specific transport, size limits, and catalog policy stay
  at their boundaries. Invalid structure is rejected; valid but unsupported content gets compilation
  diagnostics. This is not a claim of complete Spark execution support.
- Existing runtime precedence remains Adaptive → Magic → Chiral → Repeat.
- Compiled lookup tables and temporary legacy-source/creator adapters remain.
- Catalog still publishes the same compact and supplemental formats and uses Mana2 for lowering.
- No generated data regeneration, storage version bump, editor redesign, or analyzer changes.
- The preserved source returned by the compiler is not yet persisted by the legacy creator.

## Verification record

Step 1 verification is recorded below. Steps 2–4 have their own records; step 5 records catalog compatibility retirement below.

- `bun run lint`: passed.
- `bun run check`: passed, no errors or warnings.
- `bun test`: 506 passed.
- Focused AKL-link and pasted-import browser tests: 4 passed.
- `bun run test:e2e --workers=2`: all 110 passed. The first full run with four workers had
  one typing-feel word-progress timeout (109 passed); that test's file passed in isolation,
  and the subsequent full run passed without code changes.

### Step 1 code map

- `src/lib/sparkSchema.ts`: shared content types and `validateSparkLayout`. Returns an independent
  validated document, retaining extension fields. Rejects malformed known fields and duplicate slots.
- `src/lib/sparkCompiler.ts`: `compileSparkLayout` returns the preserved `document`, projected `keys`,
  temporary legacy behavior `source`, compiled runtime `profile`, and omission `warnings`.
- `src/lib/aklTryImport.ts`: keeps transport/wrapper handling and converts the compiled source to
  existing creator drafts. Both pasted JSON and AKL links use this path.
- `bin/akldb-cache.js`: reuses structural validation, retaining catalog-specific raw-output
  constraints. Source rows (including the number row at -1) remain intact in the cache;
  `bin/layout-transformer.js` projects only rows 0–4 into the current client catalog.
  Catalog behavior lowering remains unchanged for step 2.
- `tests/spark.test.ts`: malformed inputs, source preservation, extension fields, duplicate-hand
  identity, conflicts, and supported runtime parity through the legacy creator bridge.

Malformed optional mappings now reject an import instead of being silently skipped. Structurally
valid but unsupported features still produce omission warnings. At this historical stage, source preservation was a compiler
contract only; step 3 adds creator persistence of the original document.

## Step 2 implementation and verification

- Catalog sidecars now carry `{ format: "spark/1", layout }`, retaining validated content and
  extension fields. Compact geometry, the sidecar filename, and detail transport stay in place.
- Structurally valid raw deletion rules are accepted and preserved at ingestion; unsupported
  execution is reported by the compiler rather than rejected as malformed.
- Catalog feature flags, index/detail runtime profiles, and creator seeding use the shared compiler.
  Mana2 supplies analyzer mappings only; unsupported client features retain source and diagnostics.
- Explicit repeat and fixed-character Magic fallbacks now apply without relying on finite Mana2
  expansion. Conventional rule-free `@` retains dedicated Repeat classification; explicit claims
  suppress conventional Repeat. Identity Adaptive swaps are omitted without a conflict diagnostic.
- Magic contexts preserve literal whitespace through compilation and creator drafts. The runtime
  does not synthesize an initial word boundary. General raw rewrites/deletions remain unsupported.
- Supplemental variants, staleness, shorthand, and metadata validation are compatibility readers
  only. Their removal is deferred to step 5; creator persistence remains the step-3/4 legacy bridge.
- Cached-catalog audit: 4,328 layouts, 157 with Spark behavior, 139,515 sampled context/key
  comparisons. Analyzer mappings and Repeat classification had zero changes. 105 layouts had
  sampled output changes, all explained by Spark's explicit repeat/fixed-character fallbacks where
  the old expansion emitted nothing. This is a sampled comparison, not proof of all input sequences.
- `bun run catalog-sync --offline`: passed; rebuilt 3,930 published layouts and 153 Spark sidecars
  after existing exclusions, with no compact layout changes. Generated data remains untracked.
- Focused Magic browser tests with Spark-backed catalog/detail fixtures: 8 passed.
- Creator and AKL-import focused browser files after fixing reactive document seeding: 29 passed.
- `bun run lint`: passed.
- `bun run check`: passed, no errors or warnings.
- `bun test`: 523 passed.
- `bun run test:e2e --workers=1`: all 117 passed. An earlier two-worker run had one backup
  dirty-tab timeout (116 passed); that test passed in isolation, and the subsequent full
  single-worker run passed without code changes.
- `bun run generate:layout-details`: passed; updated 153 per-layout copies.

## Step 3 implementation and verification

- `creatorDocument.ts` owns the version-1 `{ version, format: "spark/1", layout, emulayout }`
  envelope, normalization, strict reading, content comparison, and source/edit reconciliation.
  Imported and catalog Spark content retains unsupported raw rules, number-row keys, custom
  finger assignments, and extension fields through reload, saves, backups, and shares.
- Editing a projected identity updates its known fields while retaining unrelated source fields.
  Editing/removing a projected raw-rule trigger removes its executable raw source rules so stale
  source cannot override the edit; unsupported rewrites/deletions remain stored. Replacing the
  base layout or clearing the canvas starts new source ownership.
- The Emulayout sidecar retains metadata, geometry, base selection, incomplete editor rows,
  stable row/group ids, disabled mappings, and lessons. Multi-character fixed fallbacks remain
  outside Spark defaults. The full supported editor projection is transitional recovery data;
  native editor ownership and geometry simplification remain step 4.
- Draft URLs use one UTF-8 base64url `document` field. Edit/Preview and detail tabs remain external
  view state; explicit lesson options can overlay stored settings. Default and clean saved URLs
  keep their existing compact forms. Malformed/future/oversized documents do not fall back to
  legacy fields. Share version 2 requires a valid document and excludes local ids and view state.
- Storage/backup version 3 writes documents directly. Version 1/2 query snapshots and share
  version 1 remain readable; migration occurs on successful writes/export without changing local
  ids or ordering. Legacy field codecs remain for old links and catalog edit-link seeding.
- `creatorDraftId.ts` prevents new mapping rows from colliding with restored ids. Stable content
  comparison ignores transient editor row ids while retaining group identities and source fields.
- `tests/creatorDocument.test.ts` covers source retention, targeted edits, incomplete drafts,
  fallbacks, legacy migration, malformed documents, and identity comparisons. Creator/import browser
  tests cover persistence, sharing, backup export/restore, failed writes, and tab synchronization.
- `bun run lint`: passed.
- `bun run check`: passed, no errors or warnings.
- `bun test`: 532 passed.
- Focused creator/import browser files: 30 passed; the final full run also covers retained
  imported source in backup export.
- `bun run test:e2e --workers=1`: all 117 passed. Earlier runs exposed obsolete URL assertions,
  a rapid-edit focus race in the chiral test, and one practice-timer timeout. URL assertions now
  inspect the document transport; the chiral test waits for the editor's focus advancement.
  The timer test passed in isolation and in the final full run without application changes.

## Step 4 implementation and verification

- `creatorEditor.svelte.ts` owns the live Spark document and exposes typed adapters to the existing
  keyboard and mapping controls. Each callback reconciles its edit into canonical content. The
  page no longer holds parallel source, baseline, key-grid, and mapping state. Raw name/author text,
  panel visibility, focus, and view tabs stay outside valid Spark content. Existing runtime group
  and disabled-mapping adapters remain derived data, including app-only multi-character fallbacks.
- `creatorGeometry.ts` builds character lookups, physical-slot maps, and sorted thumb lists directly
  from Spark. Source order selects the primary duplicate; every physical duplicate retains its
  slot and thumb hand. The old slot-config entry point remains a thin adapter for input-layout
  consumers, preserving their optional-hand contract. Catalog tuple generation/decoding is unchanged.
- Version-2 creator documents store sparse recovery: key-slot references plus differences,
  mapping references into the shared compiler's ordered projection, stable editor ids, groups,
  incomplete rows, and differing editor headers/values. Complete supported values live in Spark.
  Raw unsupported content and extension fields remain canonical and are never reconstructed from
  recovery data. Source-only fields on an edited row survive a temporary incomplete value in
  recovery, then return to canonical content when the row is valid. Removing its UI identity also
  removes that recovery. Metadata alone does not count as an execution edit or rewrite raw rules.
  Reference bounds and recovered fields are validated before applying a document.
- Version-1 creator envelopes remain readable, alongside existing legacy URL/share/storage
  readers. Writes upgrade the nested envelope to version 2; storage version 3 and share version 2
  stay unchanged. Legacy editor-created duplicates retain their last-slot runtime primary while
  imported explicit primaries retain source order. No compatibility readers were retired.
- `tests/creatorDocument.test.ts` adds sparse recovery, malformed references, version-1 envelope
  migration, and legacy duplicate-primary coverage. `tests/creatorGeometry.test.ts` checks source
  primary ordering, explicit hands, duplicate thumbs, gaps, unsupported rows, and typing maps.
  Pasted-import browser coverage now edits a key before saving and verifies that the backup keeps
  the edit alongside unsupported source and extensions. Catalog seeding runs once per selected
  base so document replacement cannot repeatedly reseed layouts with no special mappings.
- `bun run lint`: passed.
- `bun run check`: passed, no errors or warnings.
- `bun test`: 539 passed.
- Focused creator/import browser coverage: 34 passed; creator/detail coverage after the seeding
  fix: 39 passed.
- `bun run test:e2e --workers=1 --retries=1`: all 117 passed without retries. An earlier final
  recheck had one practice-settings dialog timeout (116 passed); that test passed in isolation
  and in the final full run without application changes.

## Step 5 catalog cleanup and compatibility policy

- The site deploys its generated catalog with the application. Retire internal schema-1
  supplemental catalogs, including variants, shorthand mappings, metadata-only records, and
  outdated/stale fields. They are no longer valid catalog input. Invalid entries are isolated
  with warnings; remaining layouts still load. Spark source extension fields remain preserved.
- Keep creator envelope version 1, legacy URL/query snapshots, share version 1, and storage/backup
  versions 1/2 readable. Their migration and recovery paths are unchanged. App-only grouping and
  multi-character fallbacks still use derived behavior adapters; they are not obsolete formats.
- `catalogSpark.ts` replaces the supplemental validator with the Spark transport reader and types.
  `compileLayoutInputRegistry` compiles Spark directly, without a variant registry. Creator seeding
  uses the same boundary. The runtime drops unused variant labels and staleness fields.
- Remove unused variant feature helpers from `bin/layout-features.js`; retain Repeat classification
  for base geometry and Magic/Repeat helpers used by the Cyanophage analyzer adapter.
- Preserve compact geometry, `layout-supplemental.json`, the per-layout `supplemental` field, and
  detail transport version 5. This is reader retirement, with no generated-output format change.
  Older cached non-Spark catalog entries are skipped; compact Repeat metadata still governs
  missing/invalid behavior fallback. Old personal data is not affected by that catalog policy.
- Audit: all 153 local aggregate behavior entries use `spark/1`; none use the retired schema.
  Browser fixtures now supply native Spark, including single-character fixed Magic defaults.
  Creator/runtime tests continue covering app-only multi-character fallbacks and Adaptive groups.
- `tests/catalogSpark.test.ts` covers source preservation, retired/future/malformed transport
  rejection, record isolation, and creator seeding. Existing persistence migration tests remain.
- The local generated-data audit validated all 153 aggregate entries and all 153 detail sidecars
  without regeneration. The aggregate compiled 152 executable profiles; valid unsupported content
  remains source data and can produce omission diagnostics rather than an executable profile.
- `bun run lint`: passed.
- `bun run check`: passed, no errors or warnings.
- `bun test`: 527 passed. Tests of the retired supplemental schema and variant helpers are removed;
  tests of still-used analyzer helpers and creator/runtime adapters remain.
- Focused browser run: 59 passed initially, with one obsolete explicit-no-op fixture assertion and
  one multi-tab deletion dialog timeout. The fixture now checks Spark's implicit no-op; both
  affected tests passed on recheck without persistence changes.
- `bun run test:e2e --workers=1 --retries=1`: completed successfully, 115 passed and 2 flaky tests
  passed on retry (detail-page Compare seeding and lesson-settings tabs). Catalog behavior,
  creator persistence, Spark import, and preview checks passed without retries.

### Legacy writer cleanup

- `writeLegacyCreatorUrlParams` had no application consumers; only unit tests still called it.
  Remove it and its key/mapping serializers, writer-only payload types, and empty-slot encoding
  helpers. Retain the old readers, current Spark document writer, and shared view/lesson handling.
- `tests/layoutCreatorUrl.test.ts` now exercises the actual document writer for current round trips.
  Fixed legacy wire data in `tests/fixtures/creator-legacy-url.json` independently tests old key
  flags, thumbs, duplicate primaries, semicolons, incomplete mappings, groups, chirals, disabled
  mappings, and lesson settings. Migration tests reuse that fixture for share version 1 and
  storage/backup versions 1/2. No user-data compatibility is retired.
- Production change: 174 lines removed, with no production additions.
- `bun run lint` and `bun run check`: passed; no type-check errors or warnings.
- `bun test`: 529 passed; focused creator document/URL/share/storage tests: 43 passed.
- Focused creator/import browser tests: 27 passed.
- `bun run test:e2e --workers=1 --retries=1`: all 117 passed without retries.

## Creator module organization

- Content snapshots, defaults, cloning, comparisons, and catalog canvas initialization move to
  `creatorContent.ts`. Consumers import them directly; snapshot names no longer imply URL ownership.
- `layoutCreatorUrl.ts` owns active document transport and view/query handling. Its old field codecs
  move to the read-only `creatorLegacyUrl.ts`; UTF-8 base64url helpers live in `creatorUrlEncoding.ts`
  so the legacy adapter does not import the active URL module.
- `creatorDocumentEdits.ts` owns Spark projection, identity reconciliation, and source metadata
  retention. `creatorDocument.ts` keeps envelope construction, reading/validation, version migration,
  and content signatures. Editing has no runtime dependency on the document decoder.
- The legacy reader names its supported formats and removal conditions. Small `COMPATIBILITY`
  branches for document version 1, share version 1, and storage/backup versions 1/2 remain beside
  shared decoding. `docs/layout-creator.md` records the removal map and compatibility policy.
- This refactor reorganizes existing behavior; it does not retire personal-data formats, change
  transport versions, or introduce additional persisted representations.
- The focused browser run exposed a normalization regression during backup import. Document
  construction now passes its already-normalized snapshot to reconciliation before Spark's
  structured cloning. A proxied-source unit test covers the boundary; the backup browser test
  passed after the fix and in the final full run.
- `bun run lint`: passed.
- `bun run check`: passed, no errors or warnings.
- `bun test`: 530 passed.
- Focused creator/import browser run: 29 passed before the backup fix; the affected backup test
  passed on recheck. The final full suite covers all 30 focused cases on the corrected code.
- `bun run test:e2e --workers=1 --retries=1`: all 117 passed without retries.

## Creator saved-layout session

- `creatorSession.svelte.ts` owns reactive saved-layout collection, active identity, persistence
  errors, dirty comparisons, and saved-layout transitions. `LayoutCreator.svelte` keeps the live
  editor and UI/browser effects, applying replacement snapshots returned by the session.
- Save, save-as-new, duplicate, delete, and backup import merge current storage before writing;
  failed persistence leaves session identity, collection, and live content unchanged. External
  storage removal and backup replacement preserve dirty drafts as unsaved canvases.
- Existing persistence, URL, Spark document, and legacy compatibility formats are unchanged.
  Repeated document projections remain a separate follow-up.
- Added browser regressions for clean-save removal after view-only changes and failed deletion
  retaining active identity, dirty content, keyboard focus, and reload recovery.
- `bun run check`: passed with no errors or warnings. `bun test`: 530 passed.
- Focused creator browser run: all 28 passed.
- The first full browser run passed 118 tests and failed the lesson-dialog keyboard focus assertion.
  Focus rechecks were intermittent (two passed and one failed in a three-repeat run); subsequent
  comparisons passed 20 repeats on committed code and 10 on the refactor. No dialog or tab behavior
  was changed as part of the session extraction.
- Final `bun run test:e2e --workers=1 --retries=1`: completed successfully with 118 passed and
  one flaky lesson-dialog focus test passing on retry. The intermittent focus assertion remains
  a verification limitation, rather than a claimed clean first-attempt pass.
- `bun run lint`: passed after the implementation and documentation updates.
