"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.baselinePath = baselinePath;
exports.hashRegistryEntries = hashRegistryEntries;
exports.readBaseline = readBaseline;
exports.writeBaseline = writeBaseline;
exports.diffRegistry = diffRegistry;
// lib/kb/baseline.ts
//
// Baseline store for on-demand drift detection.
//
// The baseline records what each registry looked like the last time the user
// accepted its state. A later `bridge-ds drift` run compares the live Figma
// extraction (and the on-disk registry) against it to answer "what moved?".
//
// WHY entry-level hashing instead of hashing the whole file:
// every registry carries a top-level `generatedAt` envelope field that is
// rewritten on *every* extraction, even when not a single component changed.
// Hashing the envelope would therefore report drift on every run — useless.
// So we hash the ENTRIES ONLY, and we hash them one by one so the report can
// name which entries were added / removed / modified rather than just saying
// "something changed".
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const hash_js_1 = require("./hash.js");
/** Where the baseline lives, relative to the KB root. Kept under `.bridge/`
 * alongside the cron sync report so KB payload directories stay clean. */
function baselinePath(kbPath) {
    return node_path_1.default.join(kbPath, ".bridge", "kb-baseline.json");
}
const DEFAULT_ID_FIELD = "key";
/**
 * Hash each registry entry individually and derive one aggregate hash.
 *
 * The aggregate is computed over the entry-hash *map*, not the entry array,
 * so it is insensitive to the order Figma happens to return entries in — the
 * REST API gives no ordering guarantee and a reshuffle is not drift.
 *
 * @param entries the registry payload array (`components`, `variables`, …)
 * @param idField field that identifies an entry across runs (default `"key"`)
 */
function hashRegistryEntries(entries, idField = DEFAULT_ID_FIELD) {
    const entryHashes = {};
    for (const entry of entries) {
        const entryHash = (0, hash_js_1.sha256)(entry);
        const raw = entry[idField];
        // Entries without a usable id still participate in the diff: they get a
        // synthetic id derived from their own content. Such an entry can only ever
        // show up as added or removed (never "modified"), which is the best any
        // identity-free comparison can do.
        const base = typeof raw === "string" || typeof raw === "number"
            ? String(raw)
            : `#anon:${entryHash.slice(0, 16)}`;
        // Duplicate ids would silently collapse into one another and under-report
        // the entry count, so disambiguate deterministically.
        let id = base;
        let n = 2;
        while (id in entryHashes)
            id = `${base}#${n++}`;
        entryHashes[id] = entryHash;
    }
    return { hash: (0, hash_js_1.sha256)(entryHashes), entryHashes };
}
/** Read the baseline, or `null` when the KB has never been baselined. */
async function readBaseline(kbPath) {
    let raw;
    try {
        raw = await (0, promises_1.readFile)(baselinePath(kbPath), "utf8");
    }
    catch {
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        if (parsed?.version !== 1 ||
            typeof parsed.baselines !== "object" ||
            parsed.baselines === null) {
            // A corrupt or future-version baseline is treated as "no baseline":
            // drift is a read-only advisory command and must never hard-fail on it.
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
async function writeBaseline(kbPath, baseline) {
    const file = baselinePath(kbPath);
    await (0, promises_1.mkdir)(node_path_1.default.dirname(file), { recursive: true });
    await (0, promises_1.writeFile)(file, JSON.stringify(baseline, null, 2) + "\n", "utf8");
}
/**
 * Classify the change between a stored baseline and a freshly computed hash
 * set. With no baseline the status is `"new"` and the id lists stay empty —
 * listing every entry as "added" on a first run would be noise, not signal.
 */
function diffRegistry(previous, current) {
    if (!previous)
        return { status: "new", added: [], removed: [], modified: [] };
    const prev = previous.entryHashes ?? {};
    const curr = current.entryHashes;
    const added = [];
    const removed = [];
    const modified = [];
    for (const id of Object.keys(curr)) {
        if (!(id in prev))
            added.push(id);
        else if (prev[id] !== curr[id])
            modified.push(id);
    }
    for (const id of Object.keys(prev)) {
        if (!(id in curr))
            removed.push(id);
    }
    added.sort();
    removed.sort();
    modified.sort();
    const changed = previous.hash !== current.hash || added.length > 0 || removed.length > 0 || modified.length > 0;
    return { status: changed ? "changed" : "unchanged", added, removed, modified };
}
//# sourceMappingURL=baseline.js.map