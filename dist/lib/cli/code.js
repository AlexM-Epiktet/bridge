"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.codeCommand = codeCommand;
exports.formatCodeResult = formatCodeResult;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const schema_js_1 = require("../compiler/schema.js");
const registry_js_1 = require("../compiler/registry.js");
const resolve_js_1 = require("../compiler/resolve.js");
const values_js_1 = require("../kb/values.js");
const token_refs_js_1 = require("../codegen-web/token-refs.js");
const component_bindings_js_1 = require("../codegen-web/component-bindings.js");
const angular_js_1 = require("../codegen-web/angular.js");
const tokens_css_js_1 = require("../codegen-web/tokens-css.js");
async function codeCommand(opts) {
    const errors = [];
    // ── Front half of the compiler pipeline ─────────────────────────────────
    const raw = await (0, promises_1.readFile)(opts.inputPath, "utf8");
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (e) {
        return {
            files: [],
            flags: [],
            notes: [],
            errors: [`${opts.inputPath}: invalid JSON — ${e.message}`],
            exitCode: 1,
        };
    }
    const schema = (0, schema_js_1.validateSceneGraph)(parsed);
    if (!schema.valid || !schema.graph) {
        return {
            files: [],
            flags: [],
            notes: [],
            errors: schema.errors.map((e) => e.message),
            exitCode: 1,
        };
    }
    const registry = (0, registry_js_1.loadRegistry)(opts.kbPath);
    const resolved = (0, resolve_js_1.resolve)(schema.graph, registry);
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
    const values = (0, values_js_1.loadTokenValues)(opts.kbPath);
    const refs = (0, token_refs_js_1.buildTokenRefs)(values);
    const bindings = (0, component_bindings_js_1.loadComponentBindings)(opts.kbPath);
    const name = opts.name ?? resolved.graph.metadata?.name ?? "component";
    const baseClassName = opts.baseClass ?? "";
    const result = (0, angular_js_1.emitAngularComponent)(resolved.graph, refs, {
        name,
        specName: resolved.graph.metadata?.name ?? name,
        strategy: opts.strategy,
        bindings,
        ...(opts.selectorPrefix ? { selectorPrefix: opts.selectorPrefix } : {}),
        ...(opts.classPrefix ? { classPrefix: opts.classPrefix } : {}),
        ...(opts.docLanguage ? { docLanguage: opts.docLanguage } : {}),
        ...(opts.emitStories !== undefined ? { emitStories: opts.emitStories } : {}),
        baseClass: baseClassName.length > 0
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
        const tokens = (0, tokens_css_js_1.emitTokensCss)(values);
        files.push({ path: "tokens.css", content: tokens.css });
        notes.push(...tokens.warnings);
    }
    else if (refs.themeCssFile) {
        notes.push(`Token stylesheet not generated: the knowledge base binds tokens to \`${refs.themeCssFile}\`, ` +
            `which already defines them. Generated code references those properties.`);
    }
    if (refs.unbound.length > 0) {
        notes.push(`${refs.unbound.length} token(s) in the knowledge base have neither a value nor a CSS ` +
            `binding. They are unusable from code until they are bound — run \`bridge-ds drift\` ` +
            `or refresh the theme lockfile.`);
    }
    if (opts.outDir) {
        for (const file of files) {
            const target = node_path_1.default.join(opts.outDir, file.path);
            await (0, promises_1.mkdir)(node_path_1.default.dirname(target), { recursive: true });
            await (0, promises_1.writeFile)(target, file.content, "utf8");
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
function formatCodeResult(result, outDir) {
    const lines = [];
    if (result.errors.length > 0) {
        lines.push("Errors:");
        for (const e of result.errors)
            lines.push(`  - ${e}`);
        return lines.join("\n");
    }
    lines.push(outDir
        ? `Generated ${result.files.length} file(s) in ${outDir}:`
        : `Generated ${result.files.length} file(s):`);
    for (const f of result.files)
        lines.push(`  - ${f.path}`);
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
        for (const n of result.notes)
            lines.push(`  - ${n}`);
    }
    return lines.join("\n");
}
//# sourceMappingURL=code.js.map