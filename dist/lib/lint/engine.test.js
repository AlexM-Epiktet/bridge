"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const engine_js_1 = require("./engine.js");
(0, node_test_1.test)("runRulesAgainstDocument returns diagnostics for a simple rule violation", async () => {
    const ruleset = {
        rules: {
            "no-foo": {
                description: "Disallow the literal 'foo'",
                given: "$.value",
                then: { function: "pattern", functionOptions: { notMatch: "^foo$" } },
                severity: "error",
                meta: {
                    bridgeApi: "1.x",
                    category: "structure",
                    surface: ["lint-time"],
                    status: "active",
                    since: "1.0.0",
                },
            },
        },
    };
    const document = { value: "foo" };
    const result = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, document, {
        source: "test.yaml",
    });
    strict_1.default.equal(result.diagnostics.length, 1);
    strict_1.default.equal(result.diagnostics[0].ruleId, "no-foo");
    strict_1.default.equal(result.diagnostics[0].severity, "error");
    strict_1.default.equal(result.diagnostics[0].category, "structure");
});
(0, node_test_1.test)("runRulesAgainstDocument returns no diagnostics when no rules fire", async () => {
    const ruleset = {
        rules: {
            "no-foo": {
                description: "Disallow 'foo'",
                given: "$.value",
                then: { function: "pattern", functionOptions: { notMatch: "^foo$" } },
                severity: "error",
                meta: {
                    bridgeApi: "1.x",
                    category: "structure",
                    surface: ["lint-time"],
                    status: "active",
                    since: "1.0.0",
                },
            },
        },
    };
    const document = { value: "bar" };
    const result = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, document, {
        source: "test.yaml",
    });
    strict_1.default.equal(result.diagnostics.length, 0);
});
(0, node_test_1.test)("runRulesAgainstDocument skips rules with severity 'off'", async () => {
    const ruleset = {
        rules: {
            "no-foo": {
                description: "Disallow 'foo'",
                given: "$.value",
                then: { function: "pattern", functionOptions: { notMatch: "^foo$" } },
                severity: "off",
                meta: {
                    bridgeApi: "1.x",
                    category: "structure",
                    surface: ["lint-time"],
                    status: "active",
                    since: "1.0.0",
                },
            },
        },
    };
    const result = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { value: "foo" }, {
        source: "test.yaml",
    });
    strict_1.default.equal(result.diagnostics.length, 0);
});
(0, node_test_1.test)("runRulesAgainstDocument isolates per-rule crashes — one bad JSONPath doesn't kill the batch", async () => {
    const ruleset = {
        rules: {
            "crashes-on-null": {
                description: "Filter with null-vulnerable JSONPath",
                given: "$.items[?(@.type == 'X')]",
                then: { function: "truthy" },
                severity: "error",
                meta: {
                    bridgeApi: "1.x",
                    category: "structure",
                    surface: ["lint-time"],
                    status: "active",
                    since: "1.0.0",
                },
            },
            "always-passes": {
                description: "Innocuous rule",
                given: "$.value",
                then: { function: "pattern", functionOptions: { match: ".*" } },
                severity: "error",
                meta: {
                    bridgeApi: "1.x",
                    category: "structure",
                    surface: ["lint-time"],
                    status: "active",
                    since: "1.0.0",
                },
            },
        },
    };
    const docWithNulls = { items: [null, { type: "X" }, null], value: "ok" };
    const result = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, docWithNulls, { source: "test" });
    // The crashing rule should produce a lint-engine/rule-crash warning,
    // and always-passes should still have run cleanly (no diagnostic on a passing doc).
    const crashDiag = result.diagnostics.find((d) => d.ruleId === "lint-engine/rule-crash");
    strict_1.default.ok(crashDiag, "rule-crash diagnostic missing");
    strict_1.default.match(crashDiag.message, /crashes-on-null/);
    // always-passes is innocuous on this doc → no diagnostic from it
    const passDiag = result.diagnostics.find((d) => d.ruleId === "always-passes");
    strict_1.default.equal(passDiag, undefined);
});
(0, node_test_1.test)("runRulesAgainstDocument fires multiple rules at differing severities", async () => {
    const ruleset = {
        rules: {
            "rule-a": {
                description: "Disallow 'foo'",
                given: "$.value",
                then: { function: "pattern", functionOptions: { notMatch: "^foo$" } },
                severity: "error",
                meta: {
                    bridgeApi: "1.x",
                    category: "structure",
                    surface: ["lint-time"],
                    status: "active",
                    since: "1.0.0",
                },
            },
            "rule-b": {
                description: "Warn on short values",
                given: "$.value",
                then: { function: "length", functionOptions: { min: 5 } },
                severity: "warn",
                meta: {
                    bridgeApi: "1.x",
                    category: "structure",
                    surface: ["lint-time"],
                    status: "active",
                    since: "1.0.0",
                },
            },
        },
    };
    const result = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { value: "foo" }, {
        source: "test.yaml",
    });
    // Both rules fire on { value: "foo" }: rule-a (pattern violation), rule-b (length<5)
    const severities = result.diagnostics.map((d) => d.severity).sort();
    strict_1.default.ok(severities.includes("error"));
    strict_1.default.ok(severities.includes("warn"));
    strict_1.default.equal(result.diagnostics.length, 2);
});
//# sourceMappingURL=engine.test.js.map