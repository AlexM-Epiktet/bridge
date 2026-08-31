"use strict";
// ---------------------------------------------------------------------------
// import.ts — `bridge-ds import`: Figma snapshot → scene graph
// ---------------------------------------------------------------------------
//
// The Figma read happens at skill level over MCP; this command is the pure,
// offline half. Splitting them that way is what makes import testable: given a
// snapshot file and a KB, the output is a function of nothing else.
//
// The command never fails on unbound values — that is the import policy, not a
// leniency setting. A non-zero exit code means "the snapshot could not be
// read", never "the design uses raw values". Flags are reported and the caller
// decides.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importCommand = importCommand;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const registry_js_1 = require("../compiler/registry.js");
const detokenize_js_1 = require("../importer/detokenize.js");
/**
 * Group flags by node so the report reads as a punch list per layer rather
 * than a flat wall of lines. Insertion order is the tree walk order, which is
 * the order a designer sees the layers in.
 */
function groupByNode(flags) {
    const grouped = new Map();
    for (const f of flags) {
        let bucket = grouped.get(f.nodePath);
        if (!bucket) {
            bucket = [];
            grouped.set(f.nodePath, bucket);
        }
        bucket.push(f);
    }
    return grouped;
}
function formatValue(value) {
    if (value === null || value === undefined)
        return "(none)";
    if (typeof value === "string")
        return value;
    if (typeof value === "number" || typeof value === "boolean")
        return String(value);
    return JSON.stringify(value);
}
/**
 * Read a snapshot, convert it, optionally write the scene graph, and print the
 * FLAG report.
 *
 * Returns the exit code instead of calling `process.exit` so the command stays
 * callable from tests and from other commands.
 */
async function importCommand(opts) {
    let tree;
    try {
        tree = JSON.parse(await (0, promises_1.readFile)(opts.treePath, "utf8"));
    }
    catch (err) {
        console.error(`Could not read snapshot "${opts.treePath}": ${err.message}`);
        return { sceneGraph: null, flags: [], exitCode: 1 };
    }
    if (!tree || typeof tree !== "object" || typeof tree.type !== "string") {
        console.error(`Snapshot "${opts.treePath}" is not a Figma node tree — expected an object with a "type" field.`);
        return { sceneGraph: null, flags: [], exitCode: 1 };
    }
    let result;
    try {
        const registry = (0, registry_js_1.loadRegistry)(opts.kbPath);
        result = (0, detokenize_js_1.detokenize)(tree, registry, opts.name ? { name: opts.name } : undefined);
    }
    catch (err) {
        console.error(`Could not load the knowledge base at "${opts.kbPath}": ${err.message}`);
        return { sceneGraph: null, flags: [], exitCode: 1 };
    }
    if (opts.outPath) {
        const dir = node_path_1.default.dirname(opts.outPath);
        if (dir && dir !== ".")
            await (0, promises_1.mkdir)(dir, { recursive: true });
        await (0, promises_1.writeFile)(opts.outPath, JSON.stringify(result.sceneGraph, null, 2) + "\n", "utf8");
    }
    // ── Report ───────────────────────────────────────────────────────────────
    const { stats, flags, warnings } = result;
    console.log(`Imported ${stats.nodes} node${stats.nodes === 1 ? "" : "s"} — ` +
        `${stats.tokensResolved} token reference${stats.tokensResolved === 1 ? "" : "s"} resolved, ` +
        `${stats.flagged} flag${stats.flagged === 1 ? "" : "s"}.`);
    if (opts.outPath)
        console.log(`Scene graph written to ${opts.outPath}`);
    for (const w of warnings)
        console.log(`  warn  ${w}`);
    if (flags.length > 0) {
        console.log("");
        console.log("FLAGS — values with no design-system binding. No token was guessed for any of");
        console.log("them; each must be tokenised by hand before this spec will compile.");
        for (const [nodePath, nodeFlags] of groupByNode(flags)) {
            console.log("");
            console.log(`  ${nodePath}`);
            for (const f of nodeFlags) {
                console.log(`    ${f.field}: ${formatValue(f.rawValue)}`);
                console.log(`      ${f.reason}`);
            }
        }
    }
    // Flags are a report, not a failure: import always succeeds once the
    // snapshot and the KB could be read.
    return { sceneGraph: result.sceneGraph, flags, exitCode: 0 };
}
//# sourceMappingURL=import.js.map