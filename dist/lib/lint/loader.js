"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
// lib/lint/loader.ts
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const js_yaml_1 = require("js-yaml");
async function fileExists(p) {
    try {
        await (0, promises_1.access)(p);
        return true;
    }
    catch (err) {
        const code = err.code;
        if (code === "ENOENT")
            return false;
        throw err; // surface EACCES, EIO, etc.
    }
}
async function loadYaml(p) {
    const raw = await (0, promises_1.readFile)(p, "utf-8");
    return (0, js_yaml_1.load)(raw, { schema: js_yaml_1.JSON_SCHEMA });
}
/**
 * Load a lint config file. Returns null if the file does not exist
 * (engine is then dormant — opt-in via presence of config).
 *
 * Resolves `extends` chains recursively. Later configs override earlier.
 */
async function loadConfig(configPath) {
    return loadConfigInner(configPath, new Set());
}
async function loadConfigInner(configPath, seen) {
    const absPath = (0, node_path_1.resolve)(configPath);
    if (seen.has(absPath)) {
        throw new Error(`Lint config cycle detected via ${absPath} (chain: ${[...seen].join(" -> ")})`);
    }
    if (!(await fileExists(absPath)))
        return null;
    seen.add(absPath);
    const raw = await loadYaml(absPath);
    const baseDir = (0, node_path_1.dirname)(absPath);
    const resolved = { rules: {} };
    for (const ext of raw.extends ?? []) {
        let extPath;
        if (ext.startsWith("bridge:")) {
            const preset = ext.slice("bridge:".length);
            extPath = (0, node_path_1.resolve)(__dirname, "builtin/_rulesets", `${preset}.yaml`);
        }
        else {
            extPath = (0, node_path_1.resolve)(baseDir, ext);
        }
        const sub = await loadConfigInner(extPath, seen);
        if (sub === null) {
            // Surface missing extends — easier debugging than silent no-op.
            if (ext.startsWith("bridge:")) {
                console.warn(`[bridge-ds lint] Preset not found: ${ext} (expected at ${extPath}). This is expected during the v7.0 build before Task 10 ships the builtin presets.`);
            }
            else {
                throw new Error(`Lint config extends missing file: ${ext} (resolved to ${extPath})`);
            }
            continue;
        }
        if (sub.rules)
            Object.assign(resolved.rules, sub.rules);
    }
    Object.assign(resolved.rules, raw.rules ?? {});
    const resolvedFunctionsDir = raw.functionsDir ? (0, node_path_1.resolve)(baseDir, raw.functionsDir) : undefined;
    return {
        ...raw,
        rules: resolved.rules,
        functionsDir: resolvedFunctionsDir,
    };
}
//# sourceMappingURL=loader.js.map