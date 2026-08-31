"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_path_1 = __importDefault(require("node:path"));
const registry_io_js_1 = require("./registry-io.js");
const FIX = node_path_1.default.resolve("test/fixtures/kb/registries");
(0, node_test_1.test)("readComponentRegistry parses components with keys", async () => {
    const r = await (0, registry_io_js_1.readComponentRegistry)(node_path_1.default.join(FIX, "components.json"));
    strict_1.default.equal(r.components.length, 1);
    strict_1.default.equal(r.components[0].key, "abc123def456");
    strict_1.default.equal(r.components[0].name, "Button");
});
(0, node_test_1.test)("readVariableRegistry parses color variables", async () => {
    const r = await (0, registry_io_js_1.readVariableRegistry)(node_path_1.default.join(FIX, "variables.json"));
    strict_1.default.equal(r.variables[0].resolvedType, "COLOR");
    strict_1.default.ok(r.variables[0].valuesByMode.light);
});
(0, node_test_1.test)("readTextStyleRegistry returns styles", async () => {
    const r = await (0, registry_io_js_1.readTextStyleRegistry)(node_path_1.default.join(FIX, "text-styles.json"));
    strict_1.default.equal(r.styles[0].fontFamily, "Inter");
});
(0, node_test_1.test)("throws on missing file", async () => {
    await strict_1.default.rejects(() => (0, registry_io_js_1.readComponentRegistry)("test/fixtures/kb/registries/does-not-exist.json"));
});
//# sourceMappingURL=registry-io.test.js.map