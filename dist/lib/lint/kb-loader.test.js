"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// lib/lint/kb-loader.test.ts
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const kb_loader_js_1 = require("./kb-loader.js");
function makeFixtureRoot(prefix) {
    return (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), prefix));
}
(0, node_test_1.test)("loadKB: returns null when registries dir is absent", () => {
    (0, kb_loader_js_1._resetKBCache)();
    const dir = makeFixtureRoot("bridge-kb-empty-");
    try {
        const snapshot = (0, kb_loader_js_1.loadKB)(dir);
        strict_1.default.equal(snapshot, null);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("loadKB: malformed JSON yields empty maps but does not throw", () => {
    (0, kb_loader_js_1._resetKBCache)();
    const dir = makeFixtureRoot("bridge-kb-malformed-");
    try {
        const regDir = node_path_1.default.join(dir, "bridge-ds/knowledge-base/registries");
        (0, node_fs_1.mkdirSync)(regDir, { recursive: true });
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "variables.json"), "{ not json");
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "components.json"), "also broken");
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "text-styles.json"), "");
        const snapshot = (0, kb_loader_js_1.loadKB)(dir);
        strict_1.default.ok(snapshot, "should still return a snapshot object");
        strict_1.default.equal(snapshot.variableByName.size, 0);
        strict_1.default.equal(snapshot.componentByName.size, 0);
        strict_1.default.equal(snapshot.textStyleByName.size, 0);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("loadKB: populated registries produce indexed snapshot", () => {
    (0, kb_loader_js_1._resetKBCache)();
    const dir = makeFixtureRoot("bridge-kb-populated-");
    try {
        const regDir = node_path_1.default.join(dir, "bridge-ds/knowledge-base/registries");
        (0, node_fs_1.mkdirSync)(regDir, { recursive: true });
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "variables.json"), JSON.stringify({
            version: 1,
            variables: [
                { key: "v1", name: "color/bg/surface/subtle", resolvedType: "COLOR", status: "active" },
                { key: "v2", name: "interaction/hover", resolvedType: "FLOAT" },
            ],
        }));
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "components.json"), JSON.stringify({
            version: 1,
            components: [{ key: "c1", name: "Button", status: "stable" }],
        }));
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "text-styles.json"), JSON.stringify({
            version: 1,
            styles: [{ key: "t1", name: "body/md" }],
        }));
        const snapshot = (0, kb_loader_js_1.loadKB)(dir);
        strict_1.default.ok(snapshot);
        strict_1.default.equal(snapshot.variableByName.size, 2);
        strict_1.default.ok(snapshot.variableByName.has("color/bg/surface/subtle"));
        strict_1.default.equal(snapshot.variableByName.get("interaction/hover")?.resolvedType, "FLOAT");
        strict_1.default.equal(snapshot.componentByName.size, 1);
        strict_1.default.equal(snapshot.textStyleByName.size, 1);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("loadKB: memoizes by cwd+kbPath", () => {
    (0, kb_loader_js_1._resetKBCache)();
    const dir = makeFixtureRoot("bridge-kb-cache-");
    try {
        const regDir = node_path_1.default.join(dir, "bridge-ds/knowledge-base/registries");
        (0, node_fs_1.mkdirSync)(regDir, { recursive: true });
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "variables.json"), JSON.stringify({ variables: [{ key: "v1", name: "x" }] }));
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "components.json"), JSON.stringify({ components: [] }));
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "text-styles.json"), JSON.stringify({ styles: [] }));
        const a = (0, kb_loader_js_1.loadKB)(dir);
        const b = (0, kb_loader_js_1.loadKB)(dir);
        strict_1.default.strictEqual(a, b, "second call should return cached snapshot reference");
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("loadKB: token name is stored without leading $ regardless of source shape", () => {
    (0, kb_loader_js_1._resetKBCache)();
    const dir = makeFixtureRoot("bridge-kb-prefix-");
    try {
        const regDir = node_path_1.default.join(dir, "bridge-ds/knowledge-base/registries");
        (0, node_fs_1.mkdirSync)(regDir, { recursive: true });
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "variables.json"), JSON.stringify({
            variables: [
                { key: "v1", name: "$color/with/prefix" },
                { key: "v2", name: "color/without/prefix" },
            ],
        }));
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "components.json"), JSON.stringify({ components: [] }));
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "text-styles.json"), JSON.stringify({ styles: [] }));
        const snapshot = (0, kb_loader_js_1.loadKB)(dir);
        strict_1.default.ok(snapshot);
        strict_1.default.ok(snapshot.variableByName.has("color/with/prefix"));
        strict_1.default.ok(snapshot.variableByName.has("color/without/prefix"));
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
//# sourceMappingURL=kb-loader.test.js.map