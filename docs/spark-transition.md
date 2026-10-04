# Spark transition

## Objective

Use Spark schema/1 as the canonical layout content, with one validator and compiler.
Keep editor state, app preferences, compiled lookup tables, and analyzer adapters separate.
The aim is fewer competing representations, not making every UI component interpret raw JSON.

## Current inventory

| Area                      | Current format                                   | Direction                                          |
| ------------------------- | ------------------------------------------------ | -------------------------------------------------- |
| AKL ingestion             | Spark plus analyzer-only Mana2 projection        | Shared Spark validation                            |
| Links / pasted imports    | Spark lowered immediately to creator drafts      | Shared compilation, then a temporary draft adapter |
| Catalog geometry          | Compact positional arrays and feature flags      | Retain delivery optimization initially             |
| Catalog behavior          | Preserved Spark documents compiled on the client | Complete in step 2                                 |
| Creator                   | Slot-based keys and Magic/Adaptive/Chiral drafts | Spark-shaped content with editor sidecar in step 4 |
| URLs                      | Independent key and mapping codecs               | Unified document transport in step 3               |
| Saves / backups           | Versioned query-string snapshots                 | Store document content directly in step 3          |
| Runtime                   | Compiled profiles and maps                       | Retain as derived data                             |
| Lessons / filters / stats | App settings and analyzer artifacts              | Keep outside Spark                                 |

Catalog behavior and imports now share Spark compilation. Mana2 remains an analyzer adapter,
not an alternative source of executable client behavior. The old supplemental format is retained
as a compatibility reader; new catalog documents do not contain variants or staleness metadata.

Creator URL serialization currently also performs cloning/normalization. Creator key construction
builds a compact catalog tuple, decodes it, then restores primary duplicate positions. Both are
candidates for removal once a common document builder exists.

## Expected savings and constraints

The audit identified a 738-line creator URL codec, 258-line supplemental validator, and multiple
source/draft/runtime conversions. A rough estimate is 500–1,000 net production lines after all
phases, not a measured deletion target. Step 1 may grow the code while creating the shared foundation.
Compatibility readers reduce immediate savings; tests, validation, and runtime logic remain necessary.

Preserve incomplete editor rows, stable UI identities, grouping, disabled mappings, base-layout
selection, lesson settings, and view state outside valid Spark content. Decide how to represent
Emulayout's multi-character fixed fallbacks before migrating saves. Do not drop unsupported raw
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
3. **Persistence and sharing — not started.** Define a versioned Spark-plus-Emulayout envelope,
   migrate storage/backups/URLs, and define legacy-reader support. Keep incomplete drafts recoverable.
4. **Editor and geometry — not started.** Use Spark-shaped content with separate transient draft
   state; build key maps directly instead of routing through compact transport.
5. **Compatibility retirement — not started.** Remove obsolete readers only under an explicit
   compatibility policy.

**Authorization: steps 1 and 2 are authorized and complete. Steps 3–5 require a new request.**

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

Step 1 verification is recorded below. Step 2 has its own record at the end; steps 3–5 have not started.

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
valid but unsupported features still produce omission warnings. Source preservation is a compiler
contract only until the persistence migration; it does not yet make creator imports lossless.

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
