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
const loader_js_1 = require("./loader.js");
const engine_js_1 = require("./engine.js");
(0, node_test_1.test)("integration: load yaml config + run on document end-to-end", async () => {
    const dir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-lint-int-"));
    await (0, promises_1.writeFile)(node_path_1.default.join(dir, "config.yaml"), `
rules:
  no-hex:
    description: "Forbid hex literals"
    given: "$..fill"
    then:
      function: pattern
      functionOptions: { notMatch: "^#" }
    severity: error
    meta:
      bridgeApi: "1.x"
      category: tokens
      surface: [compile-time, lint-time]
      status: active
      since: "1.0.0"
`);
    const config = await (0, loader_js_1.loadConfig)(node_path_1.default.join(dir, "config.yaml"));
    strict_1.default.ok(config?.rules);
    const compileRules = {};
    for (const [id, r] of Object.entries(config.rules)) {
        if (r === "off")
            continue;
        compileRules[id] = { ...r, id };
    }
    // Document that violates
    const violating = { fill: "#fff" };
    const r1 = await (0, engine_js_1.runRulesAgainstDocument)({ rules: compileRules }, violating, { source: "test" });
    strict_1.default.equal(r1.diagnostics.length, 1);
    strict_1.default.equal(r1.diagnostics[0].ruleId, "no-hex");
    // Document that passes
    const passing = { fill: "$color/background/surface/subtle" };
    const r2 = await (0, engine_js_1.runRulesAgainstDocument)({ rules: compileRules }, passing, { source: "test" });
    strict_1.default.equal(r2.diagnostics.length, 0);
});
//# sourceMappingURL=integration.test.js.map