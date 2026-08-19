---
name: coding-from-design
description: Use when the user asks to generate, scaffold, or write framework code from a Bridge spec or scene graph — phrases like "code this", "code the component", "generate the Angular component", "turn this spec into code", "implement this design". Compiles the spec, emits framework code from the resolved scene graph, reports every token and component it could not bind, and verifies the result against the Figma board.
---

{{ACTIVE_RULES}}

# Coding From Design

## Overview

Turns a Bridge spec into framework code. The scene graph is already semantic —
auto-layout frames, DS tokens, resolved component references — so the transform
is mechanical rather than heuristic. That is the structural advantage Bridge has
over pixel-based design-to-code tools: it never has to recover meaning, because
the meaning is the input.

The generator holds the same line the compiler does: **it never invents a
value.** A token the knowledge base cannot bind to CSS produces a FLAG and no
styling at all. A component with no code binding produces a marked gap, not a
plausible element. Gaps are visible in review; wrong values are not.

The Figma board is **not** an input. It is the verification surface — Gate C is
the code-side equivalent of Gate B.

## When to Use

Invoke when the user:

- says "code this", "generate the component", "implement this design"
- has a shipped or active CSpec and wants the corresponding front-end code
- wants to regenerate code after a spec change

Do NOT use if:

- there is no compiled scene graph yet — run `make` first
  (use `generating-figma-design`)
- the user wants to change the design — that is `make` or `fix`
- the user wants to ship the design — that is `shipping-and-archiving`

## Procedure

**Before starting, load:**

- `references/compiler-reference.md` (repo-root) — scene graph format
- `references/verification-gates.md` (repo-root) — Gate C sits alongside Gate B

### 1. Locate the scene graph

Prefer, in order:

1. `/tmp/bridge-scene-{name}.json` from the current `make` session
2. a scene graph regenerated from `specs/active/{name}.cspec.yaml`
3. a scene graph regenerated from `specs/shipped/{name}.cspec.yaml`

If none exists, stop and tell the user to run `make` first. Do not hand-write a
scene graph to make this command runnable.

### 2. Determine the target conventions

Read the consumer's conventions before generating, never after. Check for, in
order: a project `CLAUDE.md`, an `AGENTS.md`, a rules directory
(`.claude/rules/`), and the framework config (`eslint`, `.editorconfig`,
`.prettierrc`).

What matters to the generator:

| Setting        | Where it usually comes from                       |
| -------------- | -------------------------------------------------- |
| Selector prefix | eslint `component-selector` rule                  |
| Class naming    | existing components in the shared UI library       |
| Base class      | what existing components extend                    |
| Indentation     | `.editorconfig`                                    |
| Doc language    | existing JSDoc in the consumer's components        |

Bridge's own artifacts are English-only. **Generated application code is not a
Bridge artifact** — it belongs to the consumer's repo and follows the
consumer's conventions, including comment language. Pass `--doc-language` to
match.

### 3. Generate

```bash
bridge-ds code --input /tmp/bridge-scene-{name}.json --kb {kb-path} --out {target-dir}
```

Useful flags:

- `--strategy tailwind-daisyui` (default) or `--strategy css-vars`
- `--doc-language en|fr`
- `--base-class <Name> --base-class-import <path>`
- `--selector-prefix <p> --class-prefix <P>`
- `--no-stories`

### 4. Read the FLAG report — do not skip it

Every flag means **nothing was generated** for that property. A flag is not a
warning to be waved through; it is a hole in the output.

| Flag                              | What it means                                             | Remedy                                                                 |
| --------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| no Tailwind spacing step          | semantic spacing token with no utility mapping             | bind it in the app's theme, or map it in the theme lockfile             |
| no CSS binding                    | token has no value in the KB and no lockfile entry         | refresh the theme lockfile; on non-Enterprise plans REST cannot help    |
| not a `--color-*` / `--radius-*`  | bound, but to a property with no matching utility          | check the lockfile entry                                                |
| no Angular binding                | component has no `angular` block in `components.json`      | add the binding, or implement the component                             |
| text style outside `tailwind/*`   | typography cannot be read from the name                    | re-extract so real metrics land, or apply type by hand                  |

Report the flags to the user grouped by remedy, not as a flat list. If more than
half the styling properties flagged, say so plainly — the KB is not ready for
code generation, and generating more files will not change that.

### 5. Gate C — verify against the board

Do not claim the code matches the design without evidence.

1. Render the component (Storybook, a preview route, or the app).
2. Screenshot the rendered component **in this turn**.
3. Screenshot the Figma board **in this turn** (see
   `references/transport-adapter.md`).
4. Show both to the user and name the differences you can see.

"It should look right" is not Gate C.

### 6. Report

    ## Code generated: {name}

    Files: {n} in {target-dir}
    {file list}

    Flags: {n} — {one line per remedy group}
    Notes: {n}

    Gate C: {screenshot pair shown | not run, because …}

## Red Flags

| Rationalization                                        | Reality                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| "The spacing token is obviously 16px, I'll write `p-4`" | The KB does not know that. Emit the flag; a guess here becomes a silent visual bug. |
| "I'll write the missing component inline for now"       | An unmapped component is a gap to report, not to fill with markup.        |
| "Storybook is slow, I'll skip the screenshot"           | Gate C without a screenshot is an opinion.                               |
| "I'll hand-edit the generated file to fix the flags"    | Fix the binding in the KB and regenerate; a hand-edit is lost next run.  |
| "The token stylesheet is missing, I'll generate one"    | If a theme lockfile exists, its stylesheet is generated and CI-verified elsewhere. A second definition drifts. |
| "Every text node is a heading, I'll use `<h2>`"         | Heading level is semantic and not in the scene graph. Emit `<span>` and ask. |

## Verification

Before reporting success, confirm all of:

- [ ] `bridge-ds code` exited 0
- [ ] every FLAG was reported to the user with a remedy, none silently dropped
- [ ] no generated file contains a hardcoded colour, spacing or radius value
- [ ] the generated component compiles in the consumer's toolchain
- [ ] Gate C screenshots (rendered + Figma) were taken **in this turn** and shown
- [ ] the user confirmed the visual match

If any box is unchecked, say which one and why — do not report "done".
