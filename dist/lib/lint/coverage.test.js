"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const coverage_js_1 = require("./coverage.js");
(0, node_test_1.test)("computeCoverage groups by category", () => {
    const result = (0, coverage_js_1.computeCoverage)({
        rules: {
            "rule-a": { meta: { category: "tokens" } },
            "rule-b": { meta: { category: "tokens" } },
            "rule-c": { meta: { category: "naming" } },
        },
        diagnostics: [{ ruleId: "rule-a", category: "tokens" }],
    });
    strict_1.default.equal(result.byCategory.tokens.total, 2);
    strict_1.default.equal(result.byCategory.tokens.failed, 1);
    strict_1.default.equal(result.byCategory.tokens.passed, 1);
    strict_1.default.equal(result.byCategory.naming.total, 1);
    strict_1.default.equal(result.byCategory.naming.failed, 0);
    strict_1.default.equal(result.byCategory.naming.passed, 1);
});
(0, node_test_1.test)("renderCoverage handles empty input", () => {
    const result = (0, coverage_js_1.computeCoverage)({ rules: {}, diagnostics: [] });
    const out = (0, coverage_js_1.renderCoverage)(result);
    // No category sections (all skipped because total === 0), but header + TOTAL line.
    strict_1.default.match(out, /Bridge KB coverage:/);
    strict_1.default.match(out, /TOTAL/);
    strict_1.default.match(out, /0%/);
    strict_1.default.match(out, /0\/0/);
    // None of the category labels should appear since they have 0 total.
    strict_1.default.doesNotMatch(out, /tokens\s/);
    strict_1.default.doesNotMatch(out, /naming\s/);
});
(0, node_test_1.test)("renderCoverage handles partial byCategory map", () => {
    const r = (0, coverage_js_1.renderCoverage)({
        byCategory: { tokens: { passed: 1, failed: 0, total: 1 } },
        overall: { passed: 1, failed: 0, total: 1 },
    });
    strict_1.default.match(r, /tokens/);
    strict_1.default.match(r, /100%/);
    // Should not crash on the 6 missing categories
});
(0, node_test_1.test)("computeCoverage coerces unknown meta.category to 'structure' without crashing", () => {
    // Silence the one-time console.warn we expect for the unknown category so
    // it doesn't pollute test output. We assert it fired by checking call count.
    const originalWarn = console.warn;
    const warnings = [];
    console.warn = (msg) => {
        warnings.push(String(msg));
    };
    try {
        const result = (0, coverage_js_1.computeCoverage)({
            rules: {
                "rule-a": { meta: { category: "structure" } },
                "rule-future": { meta: { category: "future-category-not-yet-defined" } },
            },
            diagnostics: [],
        });
        // The unknown-category rule should have been coerced into "structure",
        // so structure.total bumps from 1 → 2.
        strict_1.default.equal(result.byCategory.structure.total, 2);
        strict_1.default.equal(result.byCategory.structure.passed, 2);
        strict_1.default.equal(result.overall.total, 2);
        // Render must not crash either.
        const out = (0, coverage_js_1.renderCoverage)(result);
        strict_1.default.match(out, /structure/);
        // And we must have warned exactly once about the unknown category.
        strict_1.default.equal(warnings.filter((w) => w.includes("future-category-not-yet-defined")).length, 1, "expected exactly one warning for the unknown category");
    }
    finally {
        console.warn = originalWarn;
    }
});
(0, node_test_1.test)("renderCoverage emits per-category lines and totals for non-empty input", () => {
    const result = (0, coverage_js_1.computeCoverage)({
        rules: {
            "rule-a": { meta: { category: "tokens" } },
            "rule-b": { meta: { category: "tokens" } },
            "rule-c": { meta: { category: "naming" } },
        },
        diagnostics: [{ ruleId: "rule-a", category: "tokens" }],
    });
    const out = (0, coverage_js_1.renderCoverage)(result);
    strict_1.default.match(out, /Bridge KB coverage:/);
    // tokens: 1/2 = 50%
    strict_1.default.match(out, /tokens\s+\S+\s+50%\s+1\/2/);
    // naming: 1/1 = 100%
    strict_1.default.match(out, /naming\s+\S+\s+100%\s+1\/1/);
    // TOTAL: 2/3 = 67%
    strict_1.default.match(out, /TOTAL\s+\S+\s+67%\s+2\/3/);
});
//# sourceMappingURL=coverage.test.js.map