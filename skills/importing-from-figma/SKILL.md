---
name: importing-from-figma
description: Use when the user has drawn something in Figma and wants Bridge to pick it up — phrases like "import this", "import my selection", "I drew a screen, make a spec from it", "reverse this into a spec", "detect what I made". Extracts the selected node tree, converts every design-system binding into a token reference, imports raw values as-is with a FLAG, and writes a CSpec plus snapshot.
---

{{ACTIVE_RULES}}

# Importing From Figma

## Overview

Runs the compiler backwards: a Figma node tree becomes a scene graph, and a
bound variable becomes a `$token`. Where the compiler goes
`$token → registry key → Plugin API`, this goes `bound variable → key → $token`.

**Zero inference is the whole point.** A value bound to a DS variable or style
converts deterministically, because the binding *is* the answer. A raw hex or a
hand-typed pixel value is imported exactly as it stands and recorded as a FLAG.
Bridge never looks for the "nearest" token — that is the one move that would
quietly break the guarantee the compiler exists to provide.

Import therefore never fails on unbound values. It reports them.

## When to Use

Invoke when the user:

- says "import", "detect what I drew", "make a spec from this selection"
- has built something directly in Figma that they want under Bridge's control
- wants an existing screen brought into the `make` / `fix` / `done` lifecycle

Do NOT use if:

- the user wants to generate a *new* design — that is `make`
  (use `generating-figma-design`)
- the user edited a design Bridge already generated — that is `fix`
  (use `learning-from-corrections`), which diffs against the snapshot
- the user only wants to know whether the KB is stale — that is `sync`

## Procedure

**Before starting, load:**

- `references/transport-adapter.md` (repo-root) — Figma read path
- `references/compiler-reference.md` (repo-root) — scene graph format

### 1. Read the selection

Get the selected node id. If nothing is selected, ask the user to select the
frame to import — do not guess at the current page's contents.

### 2. Extract the node tree

Run the extraction script over the selected root via Plugin API execution.

The field list is defined in code, not in prose: `SNAPSHOT_FIELDS` in
`lib/importer/snapshot.ts` is the single source of truth, and
`SNAPSHOT_ASYNC_FIELDS` lists the three fields that need an `await` to turn a
session id into a library key. Generate the script from those tables so the
contract cannot drift between this skill and the importer.

**The one detail that decides whether import works:** `boundVariables` gives the
**session-local variable id**, while `variables.json` indexes the **library
key**. The script must record both — resolve each id with
`figma.variables.getVariableByIdAsync(id).key`. Skip that and every token
resolves to nothing and every property flags.

Write the tree to `/tmp/bridge-tree-{name}.json`.

### 3. Convert

```bash
bridge-ds import --tree /tmp/bridge-tree-{name}.json --kb {kb-path} --out /tmp/bridge-scene-{name}.json
```

The command is pure and offline: the Figma read already happened in step 2.

### 4. Read the FLAG report

Flags are grouped by node. Each names the layer, the field, and the raw value.
`suggestion` is always null — by design.

Two classes of flag, with different remedies:

| Flag says                                      | Cause                                                        | Remedy                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| not bound to a design-system variable          | the designer typed a raw value                               | bind the layer to a DS variable in Figma, then re-import                        |
| bound to variable id … not in the registry     | the variable is real but the KB does not know it              | run `sync`, refresh the KB, or check the extraction recorded the key            |

State plainly that the imported spec **will not compile** until the flagged
values are tokenised — a raw number fails schema validation, and a raw hex is
caught by the `no-hardcoded-hex` lint rule. That is the intended behaviour, not
a bug to work around.

### 5. Write the CSpec

The deterministic half is done. Now write the prose half:

- `meta`: name, type (`screen` or `component`), canvas, width, height
- `intent`: what the design is for — ask the user rather than inventing it
- `layout`: the imported scene graph
- `ds_components`, `tokens`: derived from what actually resolved
- `acceptance`: ask the user

Write to `specs/active/{name}.cspec.yaml`, and the extracted tree to
`specs/active/{name}-snapshot.json` with `meta.rootNodeId` and `meta.fileKey`,
so `fix` and `done` work on it exactly as if `make` had produced it.

**Never persist Figma node ids into the scene graph or the registry.** They are
session-scoped; the snapshot's `meta` is the only place a node id belongs.

### 6. Report

    ## Imported: {name}

    Nodes: {n} · Tokens resolved: {n} · Flags: {n}

    CSpec:    specs/active/{name}.cspec.yaml
    Snapshot: specs/active/{name}-snapshot.json

    {flag summary grouped by remedy}

    Next: tokenise the flagged values in Figma and re-import, or run `make` to
    regenerate from the spec.

## Red Flags

| Rationalization                                            | Reality                                                                    |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| "`#0066FF` is clearly `$color/bg/primary`, I'll map it"     | That is inference. It is the exact move this command exists to refuse.      |
| "I'll round 15px to `$spacing/md` so it compiles"           | A spec that compiles on a guess is worse than one that flags honestly.      |
| "Only a few flags, I'll fix them by editing the YAML"       | Fix the binding in Figma. A YAML patch desynchronises the design from the spec. |
| "I'll reuse the nodeId from the snapshot next session"      | Node ids are session-scoped. Re-search.                                     |
| "The extraction script is simpler without the key lookup"   | Without the key lookup nothing resolves. That lookup *is* the import.       |
| "This design was Bridge-generated, import is fine"          | Use `fix` — it diffs against the snapshot and captures learnings.           |

## Verification

Before reporting success, confirm all of:

- [ ] `bridge-ds import` exited 0
- [ ] the extraction recorded a `key` alongside every `boundVariables` id
- [ ] every flag was reported with its raw value and a remedy
- [ ] no flag carries a suggested token — `suggestion` is null everywhere
- [ ] no Figma node id appears in the scene graph
- [ ] the CSpec and the snapshot were both written
- [ ] the user was told the spec will not compile until flags are resolved

A scene drawn entirely with DS tokens must import with **zero flags** and
recompile to an equivalent scene. If it does not, the extraction is at fault
before the importer is — check the key lookup first.
