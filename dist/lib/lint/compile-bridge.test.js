"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_path_1 = __importDefault(require("node:path"));
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const compile_bridge_js_1 = require("./compile-bridge.js");
(0, node_test_1.test)("runLintAtCompileTime returns empty diagnostics when no config", async () => {
    const result = await (0, compile_bridge_js_1.runLintAtCompileTime)({ name: "test", archetype: "card", component: "Test" }, "/nonexistent/config.yaml");
    strict_1.default.deepEqual(result.diagnostics, []);
});
(0, node_test_1.test)("runLintAtCompileTime returns empty diagnostics when config has only lint-time rules", async () => {
    const dir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-compile-bridge-"));
    const configPath = node_path_1.default.join(dir, "config.yaml");
    // Rule pattern would otherwise fire on value:"foo" — but surface is lint-time
    // only, so compile-time filter must drop it and return zero diagnostics.
    await (0, promises_1.writeFile)(configPath, `rules:
  no-foo:
    description: "Disallow 'foo'"
    given: "$.value"
    then: { function: pattern, functionOptions: { notMatch: "^foo$" } }
    severity: error
    meta: { bridgeApi: "1.x", category: structure, surface: [lint-time], status: active, since: "1.0.0" }
`);
    const result = await (0, compile_bridge_js_1.runLintAtCompileTime)({ value: "foo" }, configPath);
    strict_1.default.deepEqual(result.diagnostics, []);
});
//# sourceMappingURL=compile-bridge.test.js.map