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
const loader_js_1 = require("./loader.js");
(0, node_test_1.test)("loadConfig parses a minimal yaml config", async () => {
    const config = await (0, loader_js_1.loadConfig)(node_path_1.default.resolve("test/fixtures/lint/minimal-config.yaml"));
    strict_1.default.ok(config, "expected config to be non-null");
    strict_1.default.equal(Object.keys(config.rules ?? {}).length, 1);
    const rule = config.rules?.["test-rule"];
    strict_1.default.ok(rule && rule !== "off");
    // `assert.ok` narrows `rule` to RuleDef, so we can dereference directly.
    strict_1.default.equal(rule.severity, "warn");
    strict_1.default.equal(rule.meta.category, "structure");
});
(0, node_test_1.test)("loadConfig returns null when file is absent", async () => {
    const config = await (0, loader_js_1.loadConfig)("/nonexistent/path/config.yaml");
    strict_1.default.equal(config, null);
});
(0, node_test_1.test)("loadConfig merges extends — child rules override parent", async () => {
    const dir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-loader-"));
    await (0, promises_1.writeFile)(node_path_1.default.join(dir, "parent.yaml"), `rules:
  rule-a:
    description: "from parent"
    given: "$"
    then: { function: truthy }
    severity: warn
    meta: { bridgeApi: "1.x", category: structure, surface: [lint-time], status: active, since: "1.0.0" }
  rule-b:
    description: "from parent"
    given: "$"
    then: { function: truthy }
    severity: warn
    meta: { bridgeApi: "1.x", category: structure, surface: [lint-time], status: active, since: "1.0.0" }
`);
    await (0, promises_1.writeFile)(node_path_1.default.join(dir, "child.yaml"), `extends: [./parent.yaml]
rules:
  rule-a:
    description: "overridden by child"
    given: "$"
    then: { function: truthy }
    severity: error
    meta: { bridgeApi: "1.x", category: structure, surface: [lint-time], status: active, since: "1.0.0" }
`);
    const config = await (0, loader_js_1.loadConfig)(node_path_1.default.join(dir, "child.yaml"));
    strict_1.default.ok(config?.rules);
    // rule-a overridden, rule-b inherited
    const ruleA = config.rules["rule-a"];
    const ruleB = config.rules["rule-b"];
    strict_1.default.ok(ruleA && ruleA !== "off");
    strict_1.default.ok(ruleB && ruleB !== "off");
    strict_1.default.equal(ruleA.severity, "error"); // overridden
    strict_1.default.equal(ruleA.description, "overridden by child");
    strict_1.default.equal(ruleB.severity, "warn"); // inherited
});
(0, node_test_1.test)("loadConfig detects extends cycles", async () => {
    const dir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-loader-cycle-"));
    await (0, promises_1.writeFile)(node_path_1.default.join(dir, "a.yaml"), `extends: [./b.yaml]
rules: {}
`);
    await (0, promises_1.writeFile)(node_path_1.default.join(dir, "b.yaml"), `extends: [./a.yaml]
rules: {}
`);
    await strict_1.default.rejects(() => (0, loader_js_1.loadConfig)(node_path_1.default.join(dir, "a.yaml")), /cycle detected/);
});
(0, node_test_1.test)("loadConfig throws on missing relative extends path", async () => {
    const dir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-loader-missing-"));
    await (0, promises_1.writeFile)(node_path_1.default.join(dir, "config.yaml"), `extends: [./nonexistent.yaml]
rules: {}
`);
    await strict_1.default.rejects(() => (0, loader_js_1.loadConfig)(node_path_1.default.join(dir, "config.yaml")), /extends missing file/);
});
//# sourceMappingURL=loader.test.js.map