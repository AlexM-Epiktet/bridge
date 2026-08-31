"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// lib/lint/builtin.test.ts
// Fixture-driven test for every built-in rule:
//   - asserts every rule directory has positive + negative fixtures
//   - asserts positive fixtures DO NOT trigger the rule
//   - asserts negative fixtures DO trigger the rule
// Rules that rely on custom (non-Spectral-builtin) functions are skipped in
// the firing test until their function impls land.
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const js_yaml_1 = require("js-yaml");
const engine_js_1 = require("./engine.js");
const BUILTIN_ROOT = node_path_1.default.resolve("lib/lint/builtin");
async function listCategoryDirs() {
    const entries = await (0, promises_1.readdir)(BUILTIN_ROOT, { withFileTypes: true });
    return entries
        .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
        .map((e) => node_path_1.default.join(BUILTIN_ROOT, e.name));
}
async function listRuleDirs(categoryDir) {
    const entries = await (0, promises_1.readdir)(categoryDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => node_path_1.default.join(categoryDir, e.name));
}
async function loadRule(ruleDir) {
    const yamlPath = node_path_1.default.join(ruleDir, "rule.yaml");
    try {
        const raw = await (0, promises_1.readFile)(yamlPath, "utf-8");
        const parsed = (0, js_yaml_1.load)(raw, { schema: js_yaml_1.JSON_SCHEMA });
        const [id, rule] = Object.entries(parsed.rules)[0];
        return { id, rule: { ...rule, id } };
    }
    catch {
        return null;
    }
}
(0, node_test_1.test)("every built-in rule has positive + negative fixtures", async () => {
    for (const catDir of await listCategoryDirs()) {
        for (const ruleDir of await listRuleDirs(catDir)) {
            const ruleId = node_path_1.default.basename(ruleDir);
            const positiveDir = node_path_1.default.join(ruleDir, "fixtures", "positive");
            const negativeDir = node_path_1.default.join(ruleDir, "fixtures", "negative");
            try {
                const pos = await (0, promises_1.readdir)(positiveDir);
                const neg = await (0, promises_1.readdir)(negativeDir);
                strict_1.default.ok(pos.length > 0, `${ruleId}: missing positive fixtures`);
                strict_1.default.ok(neg.length > 0, `${ruleId}: missing negative fixtures`);
            }
            catch (err) {
                throw new Error(`${ruleId}: fixtures dir missing — ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }
});
(0, node_test_1.test)("every rule passes positive fixtures and fails negative ones", async () => {
    // Spectral built-in functions only — skip rules that use custom functions
    // (those need their function impls landed first).
    const BUILTIN_FUNCTIONS = new Set([
        "pattern",
        "enumeration",
        "truthy",
        "falsy",
        "length",
        "schema",
        "casing",
        "alphabetical",
        "defined",
        "undefined",
        "xor",
        "or",
        "typedEnum",
        "unreferencedReusableObject",
    ]);
    for (const catDir of await listCategoryDirs()) {
        for (const ruleDir of await listRuleDirs(catDir)) {
            const ruleId = node_path_1.default.basename(ruleDir);
            const loaded = await loadRule(ruleDir);
            if (!loaded)
                continue;
            const { rule } = loaded;
            const fnName = rule.then.function;
            if (!BUILTIN_FUNCTIONS.has(fnName)) {
                // Rule uses a custom function — skip until its impl lands.
                continue;
            }
            const positiveDir = node_path_1.default.join(ruleDir, "fixtures", "positive");
            for (const f of await (0, promises_1.readdir)(positiveDir)) {
                if (!f.endsWith(".yaml") && !f.endsWith(".cspec.yaml") && !f.endsWith(".json"))
                    continue;
                const raw = await (0, promises_1.readFile)(node_path_1.default.join(positiveDir, f), "utf-8");
                const doc = f.endsWith(".json") ? JSON.parse(raw) : (0, js_yaml_1.load)(raw, { schema: js_yaml_1.JSON_SCHEMA });
                const r = await (0, engine_js_1.runRulesAgainstDocument)({ rules: { [ruleId]: rule } }, doc, { source: f });
                strict_1.default.equal(r.diagnostics.length, 0, `${ruleId}: positive fixture ${f} triggered unexpectedly — ${JSON.stringify(r.diagnostics)}`);
            }
            const negativeDir = node_path_1.default.join(ruleDir, "fixtures", "negative");
            for (const f of await (0, promises_1.readdir)(negativeDir)) {
                if (!f.endsWith(".yaml") && !f.endsWith(".cspec.yaml") && !f.endsWith(".json"))
                    continue;
                const raw = await (0, promises_1.readFile)(node_path_1.default.join(negativeDir, f), "utf-8");
                const doc = f.endsWith(".json") ? JSON.parse(raw) : (0, js_yaml_1.load)(raw, { schema: js_yaml_1.JSON_SCHEMA });
                const r = await (0, engine_js_1.runRulesAgainstDocument)({ rules: { [ruleId]: rule } }, doc, { source: f });
                strict_1.default.ok(r.diagnostics.length > 0, `${ruleId}: negative fixture ${f} did NOT trigger`);
            }
        }
    }
});
//# sourceMappingURL=builtin.test.js.map