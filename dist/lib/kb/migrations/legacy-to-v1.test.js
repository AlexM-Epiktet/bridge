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
const legacy_to_v1_js_1 = require("./legacy-to-v1.js");
const schema_version_js_1 = require("../schema-version.js");
// Fixture path resolves from CWD (repo root) — matches existing test convention.
const FIXTURE = node_path_1.default.resolve("test/fixtures/kb/legacy-grouped");
function cloneFixture() {
    const dir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-migrate-"));
    (0, node_fs_1.cpSync)(FIXTURE, dir, { recursive: true });
    return dir;
}
(0, node_test_1.test)("migrateLegacyToV1 flattens grouped components into a flat array", async () => {
    const dir = cloneFixture();
    try {
        await (0, legacy_to_v1_js_1.migrateLegacyToV1)(dir);
        const raw = (0, node_fs_1.readFileSync)(node_path_1.default.join(dir, "knowledge-base", "registries", "components.json"), "utf8");
        const parsed = JSON.parse(raw);
        strict_1.default.ok(Array.isArray(parsed.components));
        strict_1.default.equal(parsed.components.length, 2);
        strict_1.default.equal(parsed.version, schema_version_js_1.CURRENT_KB_SCHEMA_VERSION);
        const names = parsed.components.map((c) => c.name).sort();
        strict_1.default.deepEqual(names, ["Button", "Input"]);
        const inputEntry = parsed.components.find((c) => c.name === "Input");
        strict_1.default.equal(inputEntry.category, "forms");
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("migrateLegacyToV1 adds version and generatedAt to variables.json if absent", async () => {
    const dir = cloneFixture();
    try {
        await (0, legacy_to_v1_js_1.migrateLegacyToV1)(dir);
        const raw = (0, node_fs_1.readFileSync)(node_path_1.default.join(dir, "knowledge-base", "registries", "variables.json"), "utf8");
        const parsed = JSON.parse(raw);
        strict_1.default.equal(parsed.version, schema_version_js_1.CURRENT_KB_SCHEMA_VERSION);
        strict_1.default.ok(typeof parsed.generatedAt === "string");
        strict_1.default.equal(parsed.variables.length, 1);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("migrateLegacyToV1 adds version to text-styles.json", async () => {
    const dir = cloneFixture();
    try {
        await (0, legacy_to_v1_js_1.migrateLegacyToV1)(dir);
        const raw = (0, node_fs_1.readFileSync)(node_path_1.default.join(dir, "knowledge-base", "registries", "text-styles.json"), "utf8");
        const parsed = JSON.parse(raw);
        strict_1.default.equal(parsed.version, schema_version_js_1.CURRENT_KB_SCHEMA_VERSION);
        strict_1.default.equal(parsed.styles.length, 1);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("migrateLegacyToV1 stamps version on icons.json when present, skips when absent", async () => {
    const dir = cloneFixture();
    const iconsFile = node_path_1.default.join(dir, "knowledge-base", "registries", "icons.json");
    const fs = await import("node:fs");
    fs.writeFileSync(iconsFile, JSON.stringify({ items: [{ name: "check" }] }));
    try {
        await (0, legacy_to_v1_js_1.migrateLegacyToV1)(dir);
        const parsed = JSON.parse(fs.readFileSync(iconsFile, "utf8"));
        strict_1.default.equal(parsed.version, schema_version_js_1.CURRENT_KB_SCHEMA_VERSION);
        strict_1.default.ok(typeof parsed.generatedAt === "string");
        strict_1.default.equal(parsed.items.length, 1);
        // logos.json absent → migration does not create it
        const logosFile = node_path_1.default.join(dir, "knowledge-base", "registries", "logos.json");
        strict_1.default.equal(fs.existsSync(logosFile), false);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("after migration, assertKBCompatible passes", async () => {
    const dir = cloneFixture();
    try {
        await (0, legacy_to_v1_js_1.migrateLegacyToV1)(dir);
        (0, schema_version_js_1.assertKBCompatible)(dir);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
//# sourceMappingURL=legacy-to-v1.test.js.map