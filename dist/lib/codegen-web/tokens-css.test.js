"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const tokens_css_js_1 = require("./tokens-css.js");
function index(variables, textStyles = [], modes = ["light"], defaultMode = "light") {
    return {
        variables,
        variableByName: new Map(variables.map((v) => [v.name, v])),
        variableByKey: new Map(variables.map((v) => [v.key, v])),
        textStyles,
        textStyleByName: new Map(textStyles.map((s) => [s.name, s])),
        textStyleByKey: new Map(textStyles.map((s) => [s.key, s])),
        themeByName: new Map(),
        themeByKey: new Map(),
        themeCssFile: null,
        modes,
        defaultMode,
        warnings: [],
    };
}
(0, node_test_1.test)("cssVarName slugifies a token path", () => {
    strict_1.default.equal((0, tokens_css_js_1.cssVarName)("color/bg/primary"), "--color-bg-primary");
    strict_1.default.equal((0, tokens_css_js_1.cssVarName)("$spacing/md"), "--spacing-md");
    strict_1.default.equal((0, tokens_css_js_1.cssVarName)("color/bg/primary", "ds"), "--ds-color-bg-primary");
});
(0, node_test_1.test)("the default mode lands on :root and other modes get their own selector", () => {
    const { css } = (0, tokens_css_js_1.emitTokensCss)(index([
        {
            key: "K1",
            name: "color/bg/primary",
            resolvedType: "COLOR",
            valuesByMode: {
                light: { kind: "color", hex: "#0066ff", alpha: 1 },
                dark: { kind: "color", hex: "#3385ff", alpha: 1 },
            },
        },
    ], [], ["light", "dark"]));
    strict_1.default.match(css, /:root \{\n {2}--color-bg-primary: #0066ff;\n\}/);
    strict_1.default.match(css, /\[data-theme="dark"\] \{\n {2}--color-bg-primary: #3385ff;/);
    strict_1.default.match(css, /@media \(prefers-color-scheme: dark\)/);
});
(0, node_test_1.test)("a FLOAT with a dimensional Figma scope gets px", () => {
    const { css, warnings } = (0, tokens_css_js_1.emitTokensCss)(index([
        {
            key: "K1",
            name: "sizing/gutter",
            resolvedType: "FLOAT",
            scopes: ["GAP"],
            valuesByMode: { light: { kind: "number", value: 16 } },
        },
    ]));
    strict_1.default.match(css, /--sizing-gutter: 16px;/);
    strict_1.default.deepEqual(warnings, []);
});
(0, node_test_1.test)("an OPACITY-scoped FLOAT stays unitless", () => {
    const { css } = (0, tokens_css_js_1.emitTokensCss)(index([
        {
            key: "K1",
            name: "effect/disabled",
            resolvedType: "FLOAT",
            scopes: ["OPACITY"],
            valuesByMode: { light: { kind: "number", value: 0.5 } },
        },
    ]));
    strict_1.default.match(css, /--effect-disabled: 0\.5;/);
});
(0, node_test_1.test)("an unscoped FLOAT falls back to the name convention and warns when ambiguous", () => {
    const scoped = (0, tokens_css_js_1.emitTokensCss)(index([
        {
            key: "K1",
            name: "spacing/md",
            resolvedType: "FLOAT",
            valuesByMode: { light: { kind: "number", value: 16 } },
        },
    ]));
    strict_1.default.match(scoped.css, /--spacing-md: 16px;/);
    strict_1.default.deepEqual(scoped.warnings, []);
    const ambiguous = (0, tokens_css_js_1.emitTokensCss)(index([
        {
            key: "K2",
            name: "ratio/golden",
            resolvedType: "FLOAT",
            valuesByMode: { light: { kind: "number", value: 1.618 } },
        },
    ]));
    strict_1.default.match(ambiguous.css, /--ratio-golden: 1\.618;/);
    strict_1.default.ok(ambiguous.warnings.some((w) => w.includes("no dimensional scope")));
});
(0, node_test_1.test)("a translucent colour is emitted without inventing an opaque hex", () => {
    const { css } = (0, tokens_css_js_1.emitTokensCss)(index([
        {
            key: "K1",
            name: "color/overlay",
            resolvedType: "COLOR",
            valuesByMode: { light: { kind: "color", hex: "#000000", alpha: 0.5 } },
        },
    ]));
    strict_1.default.match(css, /--color-overlay: color-mix\(in srgb, #000000 50%, transparent\);/);
});
(0, node_test_1.test)("text styles become utility classes with real metrics", () => {
    const { css } = (0, tokens_css_js_1.emitTokensCss)(index([], [
        {
            key: "S1",
            name: "heading/xl",
            fontFamily: "Inter",
            fontStyle: "SemiBold",
            fontSize: 24,
            lineHeight: 32,
            letterSpacing: -0.5,
            metricsResolved: true,
        },
    ]));
    strict_1.default.match(css, /\.text-heading-xl \{/);
    strict_1.default.match(css, /font-size: 24px;/);
    strict_1.default.match(css, /line-height: 32px;/);
    strict_1.default.match(css, /font-weight: 600;/);
    strict_1.default.match(css, /letter-spacing: -0\.5px;/);
});
(0, node_test_1.test)("text styles with unresolved metrics are skipped and reported", () => {
    const { css, warnings } = (0, tokens_css_js_1.emitTokensCss)(index([], [
        {
            key: "S1",
            name: "heading/xl",
            fontFamily: "Inter",
            fontStyle: "Regular",
            fontSize: 14,
            lineHeight: 20,
            metricsResolved: false,
        },
    ]));
    strict_1.default.doesNotMatch(css, /\.text-heading-xl/);
    strict_1.default.ok(warnings.some((w) => w.includes("1 text style(s) skipped")));
});
(0, node_test_1.test)("a percentage line height is preserved as a ratio", () => {
    const { css } = (0, tokens_css_js_1.emitTokensCss)(index([], [
        {
            key: "S1",
            name: "body/md",
            fontFamily: "Inter",
            fontStyle: "Regular",
            fontSize: 16,
            lineHeight: "150%",
            metricsResolved: true,
        },
    ]));
    strict_1.default.match(css, /line-height: 150%;/);
});
//# sourceMappingURL=tokens-css.test.js.map