"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const compile_js_1 = require("./compile.js");
(0, node_test_1.test)("compile fails when a compile-time rule is violated", async () => {
    const dir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-compile-lint-"));
    await (0, promises_1.writeFile)(node_path_1.default.join(dir, "config.yaml"), `
rules:
  no-hex-fill:
    description: "No hex"
    given: "$..fill"
    then:
      function: pattern
      functionOptions: { notMatch: "^#" }
    severity: error
    meta:
      bridgeApi: "1.x"
      category: tokens
      surface: [compile-time]
      status: active
      since: "1.0.0"
`);
    const result = await (0, compile_js_1.compile)({ name: "test", archetype: "card", component: "Test", fill: "#fff" }, { lintConfigPath: node_path_1.default.join(dir, "config.yaml") });
    strict_1.default.equal(result.ok, false);
    strict_1.default.ok(result.errors.some((e) => e.ruleId === "no-hex-fill"));
});
(0, node_test_1.test)("compile passes when lint config is absent (backward compat)", async () => {
    const result = await (0, compile_js_1.compile)({ name: "test", archetype: "card", component: "Test", fill: "#fff" }, { lintConfigPath: "/nonexistent.yaml" });
    strict_1.default.ok("ok" in result);
});
//# sourceMappingURL=compile-with-lint.test.js.map