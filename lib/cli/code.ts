// ---------------------------------------------------------------------------
// code.ts — `bridge-ds code`: generate framework code from a scene graph
// ---------------------------------------------------------------------------
//
// Reuses the front half of the compiler pipeline — schema, registry, resolve —
// and swaps the Figma emitter for a web one. The resolved graph is the shared
// boundary: by the time it exists, every `$token` has become a registry entry
// and every component reference has been checked, which is exactly the input a
// correct code generator needs.
//
// This command never talks to Figma. The board is the verification surface,
// not the source, so generation stays deterministic and runnable offline.

import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateSceneGraph } from "../compiler/schema.js";
import { loadRegistry } from "../compiler/registry.js";
import { resolve as resolveGraph } from "../compiler/resolve.js";
import { loadTokenValues } from "../kb/values.js";
import { buildTokenRefs } from "../codegen-web/token-refs.js";
import { loadComponentBindings } from "../codegen-web/component-bindings.js";
import { emitAngularComponent } from "../codegen-web/angular.js";
import { emitTokensCss } from "../codegen-web/tokens-css.js";
import type { StyleStrategy } from "../codegen-web/utility-map.js";
import type { GeneratedFile } from "../codegen-web/angular.js";

export interface CodeOptions {
  /** Path to a scene-graph JSON file. */
  inputPath: string;
  kbPath: string;
  /** Output directory. When omitted the files are returned but not written. */
  outDir?: string;
  /** Component name; defaults to the scene's metadata name. */
  name?: string;
  target?: "angular";
  strategy?: StyleStrategy;
  docLanguage?: "en" | "fr";
  selectorPrefix?: string;
  classPrefix?: string;
  /** Base class every generated component extends. `""` disables it. */
  baseClass?: string;
  baseClassImport?: string;
  emitStories?: boolean;
}

export interface CodeResult {
  files: GeneratedFile[];
  flags: Array<{ nodePath: string; role: string; token: string; reason: string }>;
  notes: string[];
  errors: string[];
  exitCode: number;
}

export async function codeCommand(opts: CodeOptions): Promise<CodeResult> {
  const errors: string[] = [];

  // ── Front half of the compiler pipeline ─────────────────────────────────
  const raw = await readFile(opts.inputPath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return {
      files: [],
      flags: [],
      notes: [],
      errors: [`${opts.inputPath}: invalid JSON — ${(e as Error).message}`],
      exitCode: 1,
    };
  }

  const schema = validateSceneGraph(parsed);
  if (!schema.valid || !schema.graph) {
    return {
      files: [],
      flags: [],
      notes: [],
      errors: schema.errors.map((e) => e.message),
      exitCode: 1,
    };
  }

  const registry = loadRegistry(opts.kbPath);
  const resolved = resolveGraph(schema.graph, registry);
  if (resolved.errors.length > 0) {
    return {
      files: [],
      flags: [],
      notes: [],
      errors: resolved.errors.map((e) => e.message),
      exitCode: 1,
    };
  }

  // ── Values, bindings, emission ──────────────────────────────────────────
  const values = loadTokenValues(opts.kbPath);
  const refs = buildTokenRefs(values);
  const bindings = loadComponentBindings(opts.kbPath);

  const name = opts.name ?? resolved.graph.metadata?.name ?? "component";
  const baseClassName = opts.baseClass ?? "";

  const result = emitAngularComponent(resolved.graph, refs, {
    name,
    specName: resolved.graph.metadata?.name ?? name,
    strategy: opts.strategy,
    bindings,
    ...(opts.selectorPrefix ? { selectorPrefix: opts.selectorPrefix } : {}),
    ...(opts.classPrefix ? { classPrefix: opts.classPrefix } : {}),
    ...(opts.docLanguage ? { docLanguage: opts.docLanguage } : {}),
    ...(opts.emitStories !== undefined ? { emitStories: opts.emitStories } : {}),
    baseClass:
      baseClassName.length > 0
        ? { name: baseClassName, importPath: opts.baseClassImport ?? "@amelis/foundation/base" }
        : null,
  });

  const files = result.files.slice();
  const notes = result.notes.slice();

  // A token stylesheet is emitted only when the KB carries values that no
  // existing stylesheet already defines. When a theme lockfile is in play the
  // stylesheet is generated elsewhere and verified in CI — writing a second
  // definition of the same properties would put the two out of sync.
  if (refs.needsGeneratedStylesheet) {
    const tokens = emitTokensCss(values);
    files.push({ path: "tokens.css", content: tokens.css });
    notes.push(...tokens.warnings);
  } else if (refs.themeCssFile) {
    notes.push(
      `Token stylesheet not generated: the knowledge base binds tokens to \`${refs.themeCssFile}\`, ` +
        `which already defines them. Generated code references those properties.`
    );
  }

  if (refs.unbound.length > 0) {
    notes.push(
      `${refs.unbound.length} token(s) in the knowledge base have neither a value nor a CSS ` +
        `binding. They are unusable from code until they are bound — run \`bridge-ds drift\` ` +
        `or refresh the theme lockfile.`
    );
  }

  if (opts.outDir) {
    for (const file of files) {
      const target = path.join(opts.outDir, file.path);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file.content, "utf8");
    }
  }

  return {
    files,
    flags: result.flags,
    notes,
    errors,
    // Flags are findings, not failures: generation succeeded and the gaps are
    // reported. Only a broken input stops the command.
    exitCode: 0,
  };
}

/** Human-readable report for the CLI. */
export function formatCodeResult(result: CodeResult, outDir?: string): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push("Errors:");
    for (const e of result.errors) lines.push(`  - ${e}`);
    return lines.join("\n");
  }

  lines.push(
    outDir
      ? `Generated ${result.files.length} file(s) in ${outDir}:`
      : `Generated ${result.files.length} file(s):`
  );
  for (const f of result.files) lines.push(`  - ${f.path}`);

  if (result.flags.length > 0) {
    lines.push("", `Flags (${result.flags.length}) — nothing was generated for these:`);
    for (const f of result.flags) {
      lines.push(`  - [${f.role}] ${f.nodePath}`);
      lines.push(`      token: ${f.token}`);
      lines.push(`      ${f.reason}`);
    }
  }

  if (result.notes.length > 0) {
    lines.push("", "Notes:");
    for (const n of result.notes) lines.push(`  - ${n}`);
  }

  return lines.join("\n");
}
