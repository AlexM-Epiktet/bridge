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
const schema_version_js_1 = require("./schema-version.js");
function makeFixture(shape) {
    const dir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-kb-"));
    const regDir = node_path_1.default.join(dir, "knowledge-base", "registries");
    (0, node_fs_1.mkdirSync)(regDir, { recursive: true });
    if (shape === "current") {
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "components.json"), JSON.stringify({
            version: 1,
            generatedAt: "2026-04-16T00:00:00Z",
            components: [],
        }));
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "variables.json"), JSON.stringify({
            version: 1,
            generatedAt: "2026-04-16T00:00:00Z",
            variables: [],
        }));
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "text-styles.json"), JSON.stringify({
            version: 1,
            generatedAt: "2026-04-16T00:00:00Z",
            styles: [],
        }));
    }
    else if (shape === "legacy-grouped") {
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "components.json"), JSON.stringify({
            components: { forms: [], actions: [] },
        }));
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "variables.json"), JSON.stringify({
            variables: [],
        }));
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "text-styles.json"), JSON.stringify({
            styles: [],
        }));
    }
    else {
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "components.json"), JSON.stringify({
            version: 999,
            generatedAt: "2030-01-01T00:00:00Z",
            components: [],
        }));
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "variables.json"), JSON.stringify({
            version: 999,
            generatedAt: "2030-01-01T00:00:00Z",
            variables: [],
        }));
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "text-styles.json"), JSON.stringify({
            version: 999,
            generatedAt: "2030-01-01T00:00:00Z",
            styles: [],
        }));
    }
    return dir;
}
(0, node_test_1.test)("CURRENT_KB_SCHEMA_VERSION is 1", () => {
    strict_1.default.equal(schema_version_js_1.CURRENT_KB_SCHEMA_VERSION, 1);
});
(0, node_test_1.test)("assertKBCompatible passes on current-shape KB", () => {
    const dir = makeFixture("current");
    try {
        (0, schema_version_js_1.assertKBCompatible)(dir);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("assertKBCompatible throws KBSchemaError on legacy grouped shape", () => {
    const dir = makeFixture("legacy-grouped");
    try {
        strict_1.default.throws(() => (0, schema_version_js_1.assertKBCompatible)(dir), (err) => {
            strict_1.default.ok(err instanceof schema_version_js_1.KBSchemaError);
            strict_1.default.match(err.message, /legacy/i);
            strict_1.default.match(err.message, /bridge-ds migrate/);
            return true;
        });
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("assertKBCompatible throws KBSchemaError when KB is newer than this CLI", () => {
    const dir = makeFixture("newer");
    try {
        strict_1.default.throws(() => (0, schema_version_js_1.assertKBCompatible)(dir), (err) => {
            strict_1.default.ok(err instanceof schema_version_js_1.KBSchemaError);
            strict_1.default.match(err.message, /newer/i);
            strict_1.default.match(err.message, /upgrade/i);
            return true;
        });
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("readKBSchemaVersion returns the version from components.json", () => {
    const dir = makeFixture("current");
    try {
        const v = (0, schema_version_js_1.readKBSchemaVersion)(dir);
        strict_1.default.equal(v, 1);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("readKBSchemaVersion returns null when registries are absent", () => {
    const dir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-kb-empty-"));
    try {
        const v = (0, schema_version_js_1.readKBSchemaVersion)(dir);
        strict_1.default.equal(v, null);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
//# sourceMappingURL=schema-version.test.js.map