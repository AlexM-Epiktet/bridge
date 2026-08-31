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
const migrate_js_1 = require("./migrate.js");
const schema_version_js_1 = require("../kb/schema-version.js");
// Fixture path resolves from CWD (repo root).
const FIXTURE = node_path_1.default.resolve("test/fixtures/kb/legacy-grouped");
(0, node_test_1.test)("migrate() converts a legacy KB and leaves it compatible", async () => {
    const dir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-cli-migrate-"));
    (0, node_fs_1.cpSync)(FIXTURE, dir, { recursive: true });
    try {
        const result = await (0, migrate_js_1.migrate)({ kbPath: dir });
        strict_1.default.equal(result.migrated, true);
        strict_1.default.equal(result.from, "legacy-grouped");
        strict_1.default.equal(result.to, 1);
        (0, schema_version_js_1.assertKBCompatible)(dir);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("migrate() is a no-op on an already-current KB", async () => {
    const dir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-cli-migrate-noop-"));
    const regDir = node_path_1.default.join(dir, "knowledge-base", "registries");
    const fs = await import("node:fs");
    fs.mkdirSync(regDir, { recursive: true });
    fs.writeFileSync(node_path_1.default.join(regDir, "components.json"), JSON.stringify({ version: 1, generatedAt: "2026-04-16T00:00:00Z", components: [] }));
    fs.writeFileSync(node_path_1.default.join(regDir, "variables.json"), JSON.stringify({ version: 1, generatedAt: "2026-04-16T00:00:00Z", variables: [] }));
    fs.writeFileSync(node_path_1.default.join(regDir, "text-styles.json"), JSON.stringify({ version: 1, generatedAt: "2026-04-16T00:00:00Z", styles: [] }));
    try {
        const result = await (0, migrate_js_1.migrate)({ kbPath: dir });
        strict_1.default.equal(result.migrated, false);
        strict_1.default.equal(result.from, "current");
        strict_1.default.equal(result.to, 1);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("migrate() refuses a KB newer than CLI supports", async () => {
    const dir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-cli-migrate-newer-"));
    const regDir = node_path_1.default.join(dir, "knowledge-base", "registries");
    const fs = await import("node:fs");
    fs.mkdirSync(regDir, { recursive: true });
    fs.writeFileSync(node_path_1.default.join(regDir, "components.json"), JSON.stringify({ version: 999, generatedAt: "2030-01-01T00:00:00Z", components: [] }));
    fs.writeFileSync(node_path_1.default.join(regDir, "variables.json"), JSON.stringify({ version: 999, generatedAt: "2030-01-01T00:00:00Z", variables: [] }));
    fs.writeFileSync(node_path_1.default.join(regDir, "text-styles.json"), JSON.stringify({ version: 999, generatedAt: "2030-01-01T00:00:00Z", styles: [] }));
    try {
        await strict_1.default.rejects(() => (0, migrate_js_1.migrate)({ kbPath: dir }), /newer/i);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
//# sourceMappingURL=migrate.test.js.map