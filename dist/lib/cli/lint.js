"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lintCommand = lintCommand;
// lib/cli/lint.ts
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const js_yaml_1 = require("js-yaml");
const loader_js_1 = require("../lint/loader.js");
const engine_js_1 = require("../lint/engine.js");
const coverage_js_1 = require("../lint/coverage.js");
const load_custom_functions_js_1 = require("../lint/load-custom-functions.js");
async function* walkCSpecs(dir) {
    for (const entry of await (0, promises_1.readdir)(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".") || entry.name === "node_modules")
            continue;
        const full = node_path_1.default.join(dir, entry.name);
        if (entry.isDirectory()) {
            yield* walkCSpecs(full);
        }
        else if (entry.name.endsWith(".cspec.yaml")) {
            yield full;
        }
    }
}
async function lintCommand(opts) {
    const config = await (0, loader_js_1.loadConfig)(opts.configPath);
    if (!config?.rules) {
        console.log("No lint config found — nothing to check.");
        return 0;
    }
    const allRules = {};
    for (const [id, r] of Object.entries(config.rules)) {
        if (r === "off")
            continue;
        if (r.meta.surface.includes("lint-time")) {
            allRules[id] = { ...r, id };
        }
    }
    const customFunctions = await (0, load_custom_functions_js_1.loadCustomFunctions)(config.functionsDir);
    const allDiagnostics = [];
    for await (const specPath of walkCSpecs(process.cwd())) {
        const doc = (0, js_yaml_1.load)(await (0, promises_1.readFile)(specPath, "utf-8"), {
            schema: js_yaml_1.JSON_SCHEMA,
        });
        const res = await (0, engine_js_1.runRulesAgainstDocument)({ rules: allRules }, doc, {
            source: node_path_1.default.relative(process.cwd(), specPath),
            customFunctions,
            cwd: process.cwd(),
        });
        allDiagnostics.push(...res.diagnostics);
    }
    for (const d of allDiagnostics) {
        console.log(`  ${d.severity.padEnd(5)} ${d.source}: [${d.ruleId}] ${d.message}`);
    }
    if (opts.coverage) {
        console.log("");
        console.log((0, coverage_js_1.renderCoverage)((0, coverage_js_1.computeCoverage)({ rules: allRules, diagnostics: allDiagnostics })));
    }
    const severityOrder = { off: 0, hint: 1, info: 2, warn: 3, error: 4 };
    const failThreshold = severityOrder[opts.failSeverity] ?? 99;
    const failedAt = allDiagnostics.find((d) => severityOrder[d.severity] >= failThreshold);
    return failedAt ? 1 : 0;
}
//# sourceMappingURL=lint.js.map