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
const registry_js_1 = require("./registry.js");
const schema_version_js_1 = require("../kb/schema-version.js");
(0, node_test_1.test)("loadRegistry refuses a legacy-grouped KB with KBSchemaError", () => {
    const dir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-compiler-guard-"));
    const regDir = node_path_1.default.join(dir, "knowledge-base", "registries");
    (0, node_fs_1.mkdirSync)(regDir, { recursive: true });
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "components.json"), JSON.stringify({
        components: { forms: [] },
    }));
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "variables.json"), JSON.stringify({ variables: [] }));
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "text-styles.json"), JSON.stringify({ styles: [] }));
    try {
        strict_1.default.throws(() => (0, registry_js_1.loadRegistry)(dir), (err) => err instanceof schema_version_js_1.KBSchemaError);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
//# sourceMappingURL=registry.schema-guard.test.js.map