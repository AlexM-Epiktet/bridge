"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const baseline_js_1 = require("./baseline.js");
function tempKB(label) {
    return (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), `bridge-baseline-${label}-`));
}
function baselineFor(entries) {
    const { hash, entryHashes } = (0, baseline_js_1.hashRegistryEntries)(entries);
    return {
        hash,
        entryHashes,
        entryCount: Object.keys(entryHashes).length,
        capturedAt: "2026-01-01T00:00:00.000Z",
    };
}
(0, node_test_1.test)("hashRegistryEntries is stable across key reordering", () => {
    const a = (0, baseline_js_1.hashRegistryEntries)([{ key: "btn", name: "Button", category: "actions" }]);
    const b = (0, baseline_js_1.hashRegistryEntries)([{ category: "actions", name: "Button", key: "btn" }]);
    strict_1.default.equal(a.hash, b.hash);
    strict_1.default.deepEqual(a.entryHashes, b.entryHashes);
});
(0, node_test_1.test)("hashRegistryEntries is insensitive to entry order", () => {
    const a = (0, baseline_js_1.hashRegistryEntries)([{ key: "a" }, { key: "b" }]);
    const b = (0, baseline_js_1.hashRegistryEntries)([{ key: "b" }, { key: "a" }]);
    strict_1.default.equal(a.hash, b.hash);
});
(0, node_test_1.test)("hashing ignores the volatile generatedAt envelope", () => {
    // Registries carry a `generatedAt` that changes on every extraction. Only
    // the entries are hashed, so two extractions of identical content match.
    const first = { version: 1, generatedAt: "2026-01-01T00:00:00Z", components: [{ key: "btn" }] };
    const second = { version: 1, generatedAt: "2026-08-19T12:34:56Z", components: [{ key: "btn" }] };
    strict_1.default.equal((0, baseline_js_1.hashRegistryEntries)(first.components).hash, (0, baseline_js_1.hashRegistryEntries)(second.components).hash);
});
(0, node_test_1.test)("entries without the id field still participate under a synthetic id", () => {
    const { entryHashes } = (0, baseline_js_1.hashRegistryEntries)([{ name: "no key here" }]);
    const ids = Object.keys(entryHashes);
    strict_1.default.equal(ids.length, 1);
    strict_1.default.match(ids[0], /^#anon:[0-9a-f]{16}$/);
});
(0, node_test_1.test)("hashRegistryEntries honours a custom idField", () => {
    const { entryHashes } = (0, baseline_js_1.hashRegistryEntries)([{ name: "Heading/XL", size: 32 }], "name");
    strict_1.default.deepEqual(Object.keys(entryHashes), ["Heading/XL"]);
});
(0, node_test_1.test)("duplicate ids are disambiguated instead of collapsing", () => {
    const { entryHashes } = (0, baseline_js_1.hashRegistryEntries)([
        { key: "dup", v: 1 },
        { key: "dup", v: 2 },
    ]);
    strict_1.default.deepEqual(Object.keys(entryHashes).sort(), ["dup", "dup#2"]);
});
(0, node_test_1.test)("diffRegistry reports unchanged when nothing moved", () => {
    const prev = baselineFor([{ key: "a" }, { key: "b" }]);
    const diff = (0, baseline_js_1.diffRegistry)(prev, (0, baseline_js_1.hashRegistryEntries)([{ key: "b" }, { key: "a" }]));
    strict_1.default.equal(diff.status, "unchanged");
    strict_1.default.deepEqual(diff, { status: "unchanged", added: [], removed: [], modified: [] });
});
(0, node_test_1.test)("diffRegistry classifies added, removed and modified entries", () => {
    const prev = baselineFor([
        { key: "a", v: 1 },
        { key: "b", v: 1 },
    ]);
    const diff = (0, baseline_js_1.diffRegistry)(prev, (0, baseline_js_1.hashRegistryEntries)([
        { key: "a", v: 2 },
        { key: "c", v: 1 },
    ]));
    strict_1.default.equal(diff.status, "changed");
    strict_1.default.deepEqual(diff.added, ["c"]);
    strict_1.default.deepEqual(diff.removed, ["b"]);
    strict_1.default.deepEqual(diff.modified, ["a"]);
});
(0, node_test_1.test)("diffRegistry reports status new when there is no baseline", () => {
    const diff = (0, baseline_js_1.diffRegistry)(undefined, (0, baseline_js_1.hashRegistryEntries)([{ key: "a" }]));
    strict_1.default.deepEqual(diff, { status: "new", added: [], removed: [], modified: [] });
});
(0, node_test_1.test)("readBaseline returns null when the KB has never been baselined", async () => {
    const dir = tempKB("absent");
    try {
        strict_1.default.equal(await (0, baseline_js_1.readBaseline)(dir), null);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("writeBaseline then readBaseline round-trips", async () => {
    const dir = tempKB("roundtrip");
    try {
        const baseline = {
            version: 1,
            baselines: { "components.json": baselineFor([{ key: "a" }]) },
        };
        await (0, baseline_js_1.writeBaseline)(dir, baseline);
        strict_1.default.ok((0, node_fs_1.existsSync)((0, baseline_js_1.baselinePath)(dir)));
        const read = await (0, baseline_js_1.readBaseline)(dir);
        strict_1.default.deepEqual(read, baseline);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("readBaseline treats a corrupt baseline as absent rather than throwing", async () => {
    const dir = tempKB("corrupt");
    try {
        const fs = await import("node:fs");
        fs.mkdirSync(node_path_1.default.dirname((0, baseline_js_1.baselinePath)(dir)), { recursive: true });
        fs.writeFileSync((0, baseline_js_1.baselinePath)(dir), "{ not json");
        strict_1.default.equal(await (0, baseline_js_1.readBaseline)(dir), null);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
//# sourceMappingURL=baseline.test.js.map