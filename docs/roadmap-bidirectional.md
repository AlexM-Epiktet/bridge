# Roadmap — Bidirectional Bridge (4 increments)

> **Status: all four increments delivered in v7.4.0 (2026-08-19).**
> Kept as the design record. What shipped differs from the plan in four places
> — see "What changed against the plan" at the end; those deltas came from
> reading a real knowledge base rather than from reasoning about the code.

## Grounding facts (from codebase audit)

These constraints shape every increment below:

- `compile()` has a deliberately-left socket for spec-first compilation:
  the async overload (`lib/compiler/compile.ts:122-134`) currently returns
  `sceneGraph: null` with a comment saying the CSpec → scene-graph compiler
  is future work. The CSpec → scene graph transform is done today by the
  model in-context (SKILL.md Phase D1), not by code.
- `codegen.ts` is monolithic and Figma-only: per-node emitters
  (`emitFrame`/`emitText`/…) concatenate `figma.*` calls. No emitter
  interface. The clean plug-in boundary is the `ResolvedSceneGraph` consumed
  at `compile.ts:289`.
- **The in-memory registry drops all values.** `loadRegistry()` truncates
  `valuesByMode`, `resolvedType`, and text-style metrics at load time
  (`registry.ts:170-236`). The values *do* exist on disk in
  `knowledge-base/registries/*.json`. `lib/lint/kb-loader.ts` already loads a
  value-retaining snapshot — reuse it rather than adding a third reader.
- Colors on disk are Figma RGBA floats (0–1), modes are human labels
  (`light`/`dark`), and values may be `VARIABLE_ALIAS` references — nothing
  in the repo resolves aliases today.
- The REST text-style extractor hardcodes `Inter / Regular / 14 / 20`
  (`figma-rest.ts:317-341`). Only the MCP extraction path produces real
  typography metrics. Must be fixed before any CSS typography emission.
- The component CSpec template already describes a full COMPONENT_SET
  (variant axes, per-variant overrides, exposed properties) but nothing
  downstream consumes it: `schema.ts` has no COMPONENT node type and codegen
  never emits `figma.createComponent` / `combineAsVariants`.
- `registry-io.ts` has whole-file read/write only — no upsert. The cron
  (`lib/cron/orchestrator.ts:39-44`) **overwrites `components.json`
  unconditionally**: any hand-appended entry is lost on next sync unless the
  component is actually published in Figma.
- Reverse extraction (Figma node tree → scene graph) exists only as prompt
  prose in two skills. `boundVariables` on a live node yields the **local
  variable id**, not the library `key` the registry indexes — an id↔key
  bridge is required (the MCP path can supply both).
- `lib/kb/hash.ts` (stableStringify + sha256) is written, tested, and
  **unused**. The v7.3.1 drift-guard is skill-level and time-based only; the
  CHANGELOG names a live key-existence probe as intended future work.

---

## Increment 1 — `code`: generate framework code from a CSpec

**Pillar served:** new — extends "compliant by construction" from Figma output
to code output. The CSpec is the semantic source; the Figma board is a
*verification* surface, never the codegen input.

### Scope

1. **Value-aware KB loader.** `loadRegistryWithValues()` built on (or merged
   with) `lib/lint/kb-loader.ts`. Adds: RGBA-float → hex conversion,
   `VARIABLE_ALIAS` resolution pass (with cycle detection), mode → theme
   scope mapping.
2. **Token stylesheet emitter.** `variables.json` + `text-styles.json` →
   `tokens.css`: one CSS custom property per variable
   (`$color/bg/primary` → `--color-bg-primary`), one block per mode
   (`:root` for default mode, `[data-theme="dark"]` for others), text styles
   as utility classes or mixins.
3. **Web emitter** consuming `ResolvedSceneGraph` — a parallel
   `lib/compiler/codegen-web.ts`, NOT a refactor of the Figma emitter
   (option (b): far less invasive, the resolved graph is a clean serializable
   boundary). Mapping: FRAME+auto-layout → flex container, TEXT → text
   element with text-style class, gap/padding/radius → `var(--…)`.
   First target: **Angular** (standalone component: `.ts` + template +
   styles). Emitter kept behind a small `Emitter` interface so a second
   target (React) is a new file, not a refactor.
4. **INSTANCE mapping.** New KB file
   `knowledge-base/registries/code-components.json` mapping `$comp/X` →
   `{ selector, importPath, propMap }`. INSTANCE nodes with a mapping emit
   the real component tag; without one they emit a clearly-marked stub +
   warning (same FLAG discipline as everywhere else).
5. **CLI:** `bridge-ds code --input <scene.json> --kb <path> --target
   angular --out <dir>` (new `case` in `lib/cli/main.ts` + `lib/cli/code.ts`,
   lazy import, same pattern as `compile`).
6. **Skill:** `coding-from-design` (trigger `code <spec>`): load CSpec →
   compile scene → `bridge-ds code` → render check. **Gate C**: screenshot
   of the Figma board vs rendered component (Storybook/preview) — evidence
   required, same iron law as Gate B.

### Out of scope (kill-by-default)

- Pixel-perfect diffing automation (Gate C is visual + human confirm).
- Responsive breakpoints beyond what the CSpec states.
- REACT target (interface-ready, not built).

### Pre-work / risks

- Fix or bypass the hardcoded REST text-style metrics before emitting
  typography (rely on MCP-extracted `text-styles.json`, or fetch styled-node
  metrics via REST).
- Alias resolution correctness is load-bearing for `tokens.css`.

### Definition of done

`code <spec>` on a shipped CSpec produces a compiling Angular component whose
styles reference only `var(--…)` tokens, with a Gate C screenshot pair shown
to the user.

---

## Increment 2 — Master component creation (`make` extended)

**Pillar served:** #3 (living KB) — a component created through Bridge
registers itself in the KB at creation time, closing the DS loop without
waiting for the cron.

### Scope

1. **Schema:** add `COMPONENT` and `COMPONENT_SET` to `NODE_TYPES`
   (`schema.ts`). `COMPONENT_SET` carries `variantProperties` (axes +
   defaults) and children of type `COMPONENT` (one per variant combination);
   `COMPONENT` carries `componentProperties` (TEXT / BOOLEAN /
   INSTANCE_SWAP definitions).
2. **CSpec wiring:** the existing `component-cspec.yaml` template
   (`variants.properties` / `variants.base` / `variants.items` /
   `properties`) becomes a consumed contract, not documentation. Transform:
   base tree × variant matrix → one COMPONENT child per item with its
   `set`/`overrides` applied.
3. **Codegen:** new emitters — `figma.createComponent()`, populate children
   via existing emitters, `figma.combineAsVariants()`,
   `addComponentProperty()` for exposed props. Same chunked pipeline,
   same wrap.
4. **KB write-back:** `upsertComponentEntry()` in `registry-io.ts`
   (read → upsert by `key`, fallback by `name` → whole-file write). Entries
   use the **REST/string-encoded property shape** (`encodePropertyDef`,
   `figma-rest.ts:192-198`) so variant validation in `resolve.ts` actually
   works. Bump `generatedAt`.
5. **Cron survival:** entries written by Bridge get `"source": "local"`.
   The cron merges instead of overwriting: REST result wins for any key it
   contains; `source: "local"` entries not present in the REST result are
   preserved (they exist in the file but aren't published as library
   components yet). Small change in `orchestrator.ts`, covered by tests.
6. **Skill:** extend `generating-figma-design` — `make component <desc>`
   routes to the component-CSpec path; on Gate B pass, run the KB upsert and
   report the new registry entry.

### Definition of done

`make component <desc>` produces a variant-complete COMPONENT_SET in Figma,
Gate B evidence, and the component immediately resolvable as `$comp/<name>`
in a follow-up `make` — before any cron run. A cron run does not erase it.

---

## Increment 3 — `import`: Figma scene → CSpec (zero inference)

**Policy (validated):** no token inference, ever. A value bound to a DS
variable/style converts deterministically; a raw value imports as-is and
raises a **FLAG warning**. Import never blocks — it reports.

### Scope

1. **Formalize the extraction contract.** The node-tree extraction script
   currently lives as prose in two skills (`generating-figma-design` D7,
   `learning-from-corrections` step 2). Promote it to a single shared
   reference (`references/extraction-script.md`) + a typed snapshot schema
   (`SnapshotTree` in `lib/compiler/types.ts` or `lib/kb/`). `fix` and
   `import` consume the same contract — one script to maintain.
2. **id↔key bridge.** Extraction script also returns, for every
   `boundVariables` entry, the variable's `key` (via
   `figma.variables.getVariableByIdAsync(id).key`) so the registry lookup is
   direct. Same for text styles and componentKey.
3. **Inverse resolve** (`lib/importer/detokenize.ts`): tree →
   `SceneGraph`. Bound value → `key` → registry name → `$token` ref.
   Unbound value → literal value in the node + FLAG entry
   `{nodeName, field, rawValue, suggestion: null}` (suggestion stays null:
   no inference). Structural mapping: auto-layout frame → FRAME, text →
   TEXT, instance → INSTANCE (componentKey → `$comp/…`), plain
   shapes → RECTANGLE/ELLIPSE.
4. **CLI:** `bridge-ds import --tree <snapshot.json> --kb <path> --out
   <scene.json>` — pure, deterministic, testable offline (the Figma read
   happens at skill level via MCP).
5. **Skill:** `importing-from-figma` (trigger `import <selection|node>`):
   read selection via MCP → extraction script → `bridge-ds import` →
   generate CSpec YAML from the scene graph (model does the intent/meta
   prose, code did the deterministic part) → write
   `specs/active/{name}.cspec.yaml` + snapshot → print FLAG report. The
   imported spec enters the normal `fix`/`done` lifecycle unchanged.

### Definition of done

Importing a scene drawn 100 % with DS tokens round-trips: `import` then
`compile` reproduces an equivalent scene with zero FLAGs. A scene with one
hand-typed hex imports successfully with exactly one FLAG naming the node,
the field, and the raw value.

---

## Increment 4 — `sync`: on-demand drift detection (no live sync)

**Decision:** no webhooks, no polling, no bidirectional live state. Bridge's
transactional model (make → fix → done, snapshots as sync points) is a
feature. `sync` is a read-only probe the user runs on demand.

### Scope

1. **KB drift (code):** `bridge-ds drift` — `runCron` plumbing in "compare"
   mode: extract via REST, hash each registry with the currently-unused
   `lib/kb/hash.ts`, compare against a baseline stored at
   `.bridge/kb-baseline.json` (written on every cron/sync). Report per
   registry: unchanged / changed (with entry-level added/removed/renamed
   summary). Never writes registries itself — it recommends
   `bridge-ds cron` or `resync`.
2. **Live key-existence probe** (the future work named in the v7.3.1
   CHANGELOG): optionally verify that every key referenced by active specs
   still exists in Figma. Skill-level via MCP, or REST where possible.
3. **Out-of-band edit detection (skill):** for each spec in `specs/active/`
   with a snapshot, use `figma_get_changes_since_version` (console
   transport) — or a re-extraction diff on the official transport — to
   detect whether the design was edited outside Bridge since the snapshot.
   If yes → recommend `fix`.
4. **Skill routing:** `sync` keyword added to `using-bridge`'s command map;
   output is a single drift report: KB drift + spec drift + recommended
   next command. Stays out of `compile()` entirely (determinism law).

### Definition of done

After a manual edit in Figma and a token rename in the DS file, `sync`
reports both, attributes each to the right category, and recommends `fix`
and `resync` respectively — without modifying anything.

---

## Cross-increment notes

- **Shared foundations built once:** the value-aware KB loader (Increment 1)
  also serves import's FLAG reporting; the snapshot schema + extraction
  contract (Increment 3) retro-fits `fix`, deleting prose duplication from
  two skills — a net subtraction.
- **Sequencing rationale:** codegen first (highest differentiation, zero
  schema changes), master components second (feeds the KB and gives codegen
  real components to map), import third (reuses fix machinery + snapshot
  contract), sync last (smallest, benefits from the baseline/hash
  conventions the others establish).
- **Each increment ships with:** tests following existing patterns
  (`*.test.ts` colocated), CHANGELOG entry, and skill-side docs in English.

---

## What changed against the plan

Four assumptions did not survive contact with a real knowledge base (the one at
`Amelis/bridge-ds`, 132 variables / 246 components). Each is worth recording,
because each would have produced working code that did the wrong thing.

### 1. `tokens.css` is usually the wrong output

The plan assumed the KB carries token values and Bridge should emit a
stylesheet. In the real KB **0 of 132 variables have `valuesByMode`** — the
Figma variables REST endpoint is Enterprise-gated and returns 403 on other
plans. Values live in a separate `theme-values.json` lockfile that binds each
Figma variable to a CSS custom property in a stylesheet that already exists and
is verified in CI.

So the primary path is not "generate a stylesheet" but "reference the one that
exists". `code` emits `tokens.css` only when the KB carries values that nothing
else defines; with a lockfile present it emits none and says why. Generating a
second definition of the same properties would have drifted against the CI
check on the next theme change.

### 2. The component→code mapping already existed

The plan proposed inventing `knowledge-base/code-components.json`. The registry
already carries an `angular` block per component (selector, lib, path, kind),
maintained through a documented resync procedure. Reading it instead of
inventing a parallel file removed a whole subsystem — a net subtraction, which
is the direction the project asks for.

Its `kind` values also encode when *not* to emit an element: `missing` (47
entries) and `daisyui` mean "there is nothing to call here", which is exactly
the flag the generator needs.

### 3. Utility classes, not custom properties

The plan assumed generated components would reference `var(--color-primary)`.
The consumer's own rules say the opposite: components use Tailwind/DaisyUI
utility classes (`bg-primary`), and `--am-*` custom properties are essentially
absent from the codebase. The emitter derives the utility name *from* the
lockfile's custom property (`--color-primary` → `primary`), so the class follows
the design system through renames. `css-vars` remains as a second strategy for
codebases with no utility framework.

### 4. Real names carry decorative prefixes

Published Figma libraries name things `🌀 tailwind/sans/lg/normal`, `📐 size`,
`↪ ✏️ label#6519:0`. Every lookup — text styles, variant axes, component
properties — needs to normalise before matching. Anchored or exact matching
silently missed everything on real data while passing on clean fixtures.

## Known gaps, deliberately not closed

- **Semantic spacing tokens generate nothing.** `space/*` (the layer the specs
  actually use most — 68 references to `$spacing/space/s` alone) has no value
  and no CSS binding, so `code` flags it. Closing this means binding those
  tokens in the consumer's theme and adding them to the lockfile; it is a
  design-system decision, not a compiler change.
- **Component-set variants are not wired.** `code` renders the default variant
  and exposes the axes as inputs, but does not compute the per-variant class
  differences. Deriving them is feasible — diff the variant subtrees — and is
  the obvious next increment.
- **Heading semantics.** Every text node emits `<span>`; heading level is not
  in the scene graph and is not guessed.
- **`$text/<size>/<weight>` refs do not resolve** against emoji-prefixed style
  names in the existing resolver (`$text/sans/lg` works, `$text/sans/lg/semiBold`
  does not). Pre-existing, untouched here because changing resolution would
  alter compile behaviour for existing specs.
