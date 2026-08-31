"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readComponentRegistry = readComponentRegistry;
exports.readVariableRegistry = readVariableRegistry;
exports.readTextStyleRegistry = readTextStyleRegistry;
exports.writeRegistry = writeRegistry;
exports.encodeVariantAxis = encodeVariantAxis;
exports.upsertComponentEntry = upsertComponentEntry;
const promises_1 = require("node:fs/promises");
async function readJSON(file) {
    const raw = await (0, promises_1.readFile)(file, "utf8");
    return JSON.parse(raw);
}
async function readComponentRegistry(file) {
    const r = await readJSON(file);
    if (!Array.isArray(r.components))
        throw new Error(`${file}: components[] missing`);
    for (const c of r.components) {
        if (!c.key)
            throw new Error(`${file}: component "${c.name ?? "?"}" missing required "key"`);
    }
    return r;
}
async function readVariableRegistry(file) {
    const r = await readJSON(file);
    if (!Array.isArray(r.variables))
        throw new Error(`${file}: variables[] missing`);
    for (const v of r.variables) {
        if (!v.key)
            throw new Error(`${file}: variable "${v.name ?? "?"}" missing required "key"`);
    }
    return r;
}
async function readTextStyleRegistry(file) {
    const r = await readJSON(file);
    if (!Array.isArray(r.styles))
        throw new Error(`${file}: styles[] missing`);
    return r;
}
async function writeRegistry(file, data) {
    await (0, promises_1.writeFile)(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}
/** Encode a variant axis the way the compiler's variant validator reads it. */
function encodeVariantAxis(values) {
    return `VARIANT(${values.join(",")})`;
}
/**
 * Insert or replace a component in `components.json`, matching on `key` first
 * and on `name` second.
 *
 * The name fallback matters because a component re-created in Figma gets a new
 * key while keeping its name; without it the registry would accumulate a stale
 * duplicate that `resolve()` could pick over the live one.
 *
 * Reads and rewrites the whole file — there is no partial-write path, and the
 * registries are small enough that a full rewrite is the simpler contract.
 */
async function upsertComponentEntry(file, entry) {
    let registry;
    try {
        registry = await readComponentRegistry(file);
    }
    catch {
        registry = { version: 1, generatedAt: new Date().toISOString(), components: [] };
    }
    const components = registry.components;
    const existing = components.findIndex((c) => c.key === entry.key || (typeof c.name === "string" && c.name === entry.name));
    const action = existing >= 0 ? "replaced" : "inserted";
    if (existing >= 0) {
        components.splice(existing, 1, entry);
    }
    else {
        components.push(entry);
    }
    registry.generatedAt = new Date().toISOString();
    await writeRegistry(file, registry);
    return { action, total: components.length };
}
//# sourceMappingURL=registry-io.js.map