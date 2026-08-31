"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCustomFunctions = loadCustomFunctions;
// lib/lint/load-custom-functions.ts
// Discover and load consumer-side custom Spectral functions from a directory.
// Supports both *.ts (via runtime require — works for CJS, doesn't compile TS)
// and *.js (post-compiled or hand-authored).
//
// In practice consumers either:
// - Author in TS and run `tsc` themselves, then point functionsDir at the dist
// - Author in plain JS at the path directly
// - (Future) we can add ts-node here for transparent .ts support.
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
async function fileExists(p) {
    try {
        await (0, promises_1.access)(p);
        return true;
    }
    catch {
        return false;
    }
}
async function loadCustomFunctions(functionsDir) {
    if (!functionsDir)
        return [];
    const abs = (0, node_path_1.resolve)(functionsDir);
    if (!(await fileExists(abs)))
        return [];
    const out = [];
    let entries;
    try {
        entries = await (0, promises_1.readdir)(abs);
    }
    catch {
        return [];
    }
    for (const entry of entries) {
        const ext = (0, node_path_1.extname)(entry);
        if (ext !== ".js" && ext !== ".mjs" && ext !== ".cjs") {
            // Skip .ts files — consumers must pre-compile. Log a hint.
            if (ext === ".ts") {
                console.warn(`[bridge-ds lint] Skipping ${entry} — TS files must be pre-compiled. Run \`tsc\` and point functionsDir at the dist, or rename to .js.`);
            }
            continue;
        }
        const fullPath = (0, node_path_1.join)(abs, entry);
        try {
            const mod = await import((0, node_url_1.pathToFileURL)(fullPath).href);
            const def = (mod.default ?? mod);
            if (!def || typeof def !== "object" || typeof def.fn !== "function") {
                console.warn(`[bridge-ds lint] ${entry} did not export a default BridgeFunctionDefinition; skipping.`);
                continue;
            }
            out.push({ name: def.name, fn: def.fn });
        }
        catch (err) {
            console.warn(`[bridge-ds lint] Failed to load function from ${entry}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    return out;
}
//# sourceMappingURL=load-custom-functions.js.map