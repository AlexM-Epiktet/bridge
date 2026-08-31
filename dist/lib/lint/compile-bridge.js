"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runLintAtCompileTime = runLintAtCompileTime;
// lib/lint/compile-bridge.ts
//
// Bridges the lint engine into the compiler's hot path. Called once per
// compile to run the subset of rules tagged `surface: compile-time` against
// a CSpec document.
//
// Design notes:
// - Returns an empty (zero-diagnostic) result when no config exists. This is
//   the v6 → v7 escape hatch: consumers who haven't opted into the lint
//   engine see no behavioural change.
// - Filters config to compile-time rules only. lint-time rules are handled
//   by the separate `bridge-ds lint` CLI (Task 15).
// - We pass each rule object through to the engine as-is. The engine accepts
//   `Omit<RuleDef, "id"> & { id?: string }` (RuleInput), so the id from the
//   record key is fine to leave implicit — no cast required.
const loader_js_1 = require("./loader.js");
const engine_js_1 = require("./engine.js");
const load_custom_functions_js_1 = require("./load-custom-functions.js");
function emptyResult() {
    return {
        diagnostics: [],
        coverage: {
            byCategory: {},
            overall: { passed: 0, failed: 0, total: 0 },
        },
    };
}
async function runLintAtCompileTime(spec, configPath) {
    const config = await (0, loader_js_1.loadConfig)(configPath);
    if (!config || !config.rules)
        return emptyResult();
    const compileRules = {};
    for (const [id, rule] of Object.entries(config.rules)) {
        if (rule === "off")
            continue;
        if (rule.meta.surface.includes("compile-time")) {
            compileRules[id] = rule;
        }
    }
    if (Object.keys(compileRules).length === 0)
        return emptyResult();
    const customFunctions = await (0, load_custom_functions_js_1.loadCustomFunctions)(config.functionsDir);
    return (0, engine_js_1.runRulesAgainstDocument)({ rules: compileRules }, spec, {
        source: "<cspec>",
        customFunctions,
        cwd: process.cwd(),
    });
}
//# sourceMappingURL=compile-bridge.js.map