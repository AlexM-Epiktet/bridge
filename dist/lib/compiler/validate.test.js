"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const validate_js_1 = require("./validate.js");
// Build a minimal Registry whose component carries variant metadata in the
// REAL on-disk shape: variants is Array<{ name: string; values: string[] }>.
function registryWithButtonVariants() {
    const byName = new Map([
        [
            "button",
            {
                name: "Button",
                key: "abc",
                type: "COMPONENT_SET",
                properties: {},
                variants: [
                    { name: "variant", values: ["primary", "secondary", "ghost", "danger"] },
                    { name: "size", values: ["sm", "md", "lg"] },
                ],
            },
        ],
    ]);
    return {
        variables: { byName: new Map(), bySegment: new Map() },
        components: { byName },
        textStyles: { byName: new Map(), bySegment: new Map() },
        icons: { byName: new Map() },
        logos: { byName: new Map() },
        allVariableNames: [],
        allComponentNames: ["button"],
        allStyleNames: [],
    };
}
// Same as above but the component has NO variant metadata (no-op case).
function registryWithoutVariants() {
    const byName = new Map([
        ["button", { name: "Button", key: "abc", type: "COMPONENT", properties: {} }],
    ]);
    return {
        variables: { byName: new Map(), bySegment: new Map() },
        components: { byName },
        textStyles: { byName: new Map(), bySegment: new Map() },
        icons: { byName: new Map() },
        logos: { byName: new Map() },
        allVariableNames: [],
        allComponentNames: ["button"],
        allStyleNames: [],
    };
}
(0, node_test_1.test)("top-level fillV is flagged against the synthetic AUTO root", () => {
    const graph = {
        nodes: [{ type: "FRAME", name: "Banner", layout: "VERTICAL", fillV: true }],
    };
    const result = (0, validate_js_1.validate)(graph, null);
    const codes = result.errors.map((e) => e.code);
    strict_1.default.ok(codes.includes("VALIDATE_FILL_IN_AUTO_PARENT"), "expected VALIDATE_FILL_IN_AUTO_PARENT for top-level fillV, got " + codes.join(","));
});
(0, node_test_1.test)("top-level fillH is allowed (root counter axis is FIXED)", () => {
    const graph = {
        nodes: [{ type: "FRAME", name: "Banner", layout: "VERTICAL", fillH: true }],
    };
    const result = (0, validate_js_1.validate)(graph, null);
    const codes = result.errors.map((e) => e.code);
    strict_1.default.ok(!codes.includes("VALIDATE_FILL_IN_AUTO_PARENT"), "top-level fillH must not be flagged");
});
(0, node_test_1.test)("unknown variant VALUE is flagged with VALIDATE_UNKNOWN_VARIANT", () => {
    const graph = {
        nodes: [
            {
                type: "INSTANCE",
                name: "MyButton",
                component: "Button",
                variant: { variant: "primary", size: "enormous" },
            },
        ],
    };
    const result = (0, validate_js_1.validate)(graph, registryWithButtonVariants());
    const codes = result.warnings.map((w) => w.code);
    strict_1.default.ok(codes.includes("VALIDATE_UNKNOWN_VARIANT"), "expected VALIDATE_UNKNOWN_VARIANT for size:enormous, got " + codes.join(","));
});
(0, node_test_1.test)("valid variant combo emits no VALIDATE_UNKNOWN_VARIANT warning", () => {
    const graph = {
        nodes: [
            {
                type: "INSTANCE",
                name: "MyButton",
                component: "Button",
                variant: { variant: "primary", size: "md" },
            },
        ],
    };
    const result = (0, validate_js_1.validate)(graph, registryWithButtonVariants());
    const codes = result.warnings.map((w) => w.code);
    strict_1.default.ok(!codes.includes("VALIDATE_UNKNOWN_VARIANT"), "valid variant combo must not be flagged, got " + codes.join(","));
});
(0, node_test_1.test)("component without variant metadata is a no-op", () => {
    const graph = {
        nodes: [
            {
                type: "INSTANCE",
                name: "MyButton",
                component: "Button",
                variant: { size: "enormous" },
            },
        ],
    };
    const result = (0, validate_js_1.validate)(graph, registryWithoutVariants());
    const codes = result.warnings.map((w) => w.code);
    strict_1.default.ok(!codes.includes("VALIDATE_UNKNOWN_VARIANT"), "component without variant metadata must not be flagged, got " + codes.join(","));
});
//# sourceMappingURL=validate.test.js.map