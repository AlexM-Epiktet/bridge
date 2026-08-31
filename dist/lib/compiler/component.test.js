"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const schema_js_1 = require("./schema.js");
const codegen_js_1 = require("./codegen.js");
/** Wrap nodes in a minimal valid scene-graph envelope. */
function graph(nodes) {
    return {
        version: "3.0",
        metadata: { name: "Test", width: 400, height: 300 },
        fonts: [],
        nodes,
    };
}
/** Emit a single chunk with no imports, so assertions read the raw calls. */
function emit(nodes) {
    const chunk = {
        index: 0,
        label: "build-0",
        imports: { variables: [], components: [], textStyles: [] },
        nodes,
        bridgeExports: [],
        bridgeImports: [],
    };
    return (0, codegen_js_1.generateCode)(chunk, { rootName: "Test", rootWidth: 400, rootHeight: 300 });
}
const buttonSet = {
    type: "COMPONENT_SET",
    name: "Button",
    variantProperties: [
        { name: "variant", values: ["primary", "secondary"], default: "primary" },
        { name: "size", values: ["sm", "md"] },
    ],
    children: [
        {
            type: "COMPONENT",
            name: "Primary Small",
            variantValues: { variant: "primary", size: "sm" },
            layout: "HORIZONTAL",
            children: [],
        },
        {
            type: "COMPONENT",
            name: "Primary Medium",
            variantValues: { variant: "primary", size: "md" },
            layout: "HORIZONTAL",
            children: [],
        },
        {
            type: "COMPONENT",
            name: "Secondary Small",
            variantValues: { variant: "secondary", size: "sm" },
            layout: "HORIZONTAL",
            children: [],
        },
        {
            type: "COMPONENT",
            name: "Secondary Medium",
            variantValues: { variant: "secondary", size: "md" },
            layout: "HORIZONTAL",
            children: [],
        },
    ],
};
// ─── Schema ──────────────────────────────────────────────────────────────────
(0, node_test_1.test)("a well-formed COMPONENT_SET passes schema validation", () => {
    const result = (0, schema_js_1.validateSceneGraph)(graph([buttonSet]));
    strict_1.default.deepEqual(result.errors.map((e) => e.message), []);
    strict_1.default.equal(result.valid, true);
});
(0, node_test_1.test)("a COMPONENT_SET without variant axes is rejected", () => {
    const result = (0, schema_js_1.validateSceneGraph)(graph([
        {
            type: "COMPONENT_SET",
            name: "Button",
            children: [{ type: "COMPONENT", name: "A", variantValues: {} }],
        },
    ]));
    strict_1.default.equal(result.valid, false);
    strict_1.default.ok(result.errors.some((e) => e.message.includes("variantProperties")));
});
(0, node_test_1.test)("a variant missing a value for a declared axis is rejected", () => {
    const result = (0, schema_js_1.validateSceneGraph)(graph([
        {
            type: "COMPONENT_SET",
            name: "Button",
            variantProperties: [
                { name: "variant", values: ["primary"] },
                { name: "size", values: ["sm"] },
            ],
            children: [{ type: "COMPONENT", name: "A", variantValues: { variant: "primary" } }],
        },
    ]));
    strict_1.default.equal(result.valid, false);
    strict_1.default.ok(result.errors.some((e) => e.message.includes('missing a value for axis "size"')));
});
(0, node_test_1.test)("two variants with the same combination are rejected", () => {
    const result = (0, schema_js_1.validateSceneGraph)(graph([
        {
            type: "COMPONENT_SET",
            name: "Button",
            variantProperties: [{ name: "variant", values: ["primary"] }],
            children: [
                { type: "COMPONENT", name: "A", variantValues: { variant: "primary" } },
                { type: "COMPONENT", name: "B", variantValues: { variant: "primary" } },
            ],
        },
    ]));
    strict_1.default.equal(result.valid, false);
    strict_1.default.ok(result.errors.some((e) => e.message.includes("same combination")));
});
(0, node_test_1.test)("a COMPONENT_SET may only contain COMPONENT children", () => {
    const result = (0, schema_js_1.validateSceneGraph)(graph([
        {
            type: "COMPONENT_SET",
            name: "Button",
            variantProperties: [{ name: "variant", values: ["primary"] }],
            children: [{ type: "FRAME", name: "Nope" }],
        },
    ]));
    strict_1.default.equal(result.valid, false);
    strict_1.default.ok(result.errors.some((e) => e.message.includes("may only contain COMPONENT children")));
});
(0, node_test_1.test)("an unknown component-property type is rejected", () => {
    const result = (0, schema_js_1.validateSceneGraph)(graph([
        {
            type: "COMPONENT",
            name: "Badge",
            componentProperties: [{ name: "label", type: "NUMBER" }],
        },
    ]));
    strict_1.default.equal(result.valid, false);
    strict_1.default.ok(result.errors.some((e) => e.message.includes("TEXT, BOOLEAN, INSTANCE_SWAP")));
});
(0, node_test_1.test)("a component property bound to a layer must name that layer", () => {
    const result = (0, schema_js_1.validateSceneGraph)(graph([
        {
            type: "COMPONENT",
            name: "Badge",
            componentProperties: [{ name: "label", type: "TEXT", bindTo: { field: "characters" } }],
        },
    ]));
    strict_1.default.equal(result.valid, false);
    strict_1.default.ok(result.errors.some((e) => e.message.includes('"layer"')));
});
// ─── Codegen ─────────────────────────────────────────────────────────────────
(0, node_test_1.test)("a component set creates every variant then combines them once", () => {
    const code = emit([buttonSet]);
    strict_1.default.equal((code.match(/figma\.createComponent\(\)/g) ?? []).length, 4);
    strict_1.default.equal((code.match(/figma\.combineAsVariants/g) ?? []).length, 1);
    // Variant names are the matrix coordinates, ordered by the axis declaration.
    strict_1.default.ok(code.includes('"variant=primary, size=sm"'));
    strict_1.default.ok(code.includes('"variant=secondary, size=md"'));
    // The set is named after the combine, because it does not exist before it.
    const combineAt = code.indexOf("combineAsVariants");
    const setNameAt = code.indexOf('.name = "Button"');
    strict_1.default.ok(combineAt < setNameAt, "the set must be named after it is combined");
});
(0, node_test_1.test)("variant naming follows the axis order, not the authoring order", () => {
    const code = emit([
        {
            type: "COMPONENT_SET",
            name: "Chip",
            variantProperties: [
                { name: "tone", values: ["neutral"] },
                { name: "state", values: ["on"] },
            ],
            children: [{ type: "COMPONENT", name: "A", variantValues: { state: "on", tone: "neutral" } }],
        },
    ]);
    strict_1.default.ok(code.includes('"tone=neutral, state=on"'));
});
(0, node_test_1.test)("component properties are added to the set and bound to a layer", () => {
    const code = emit([
        {
            type: "COMPONENT_SET",
            name: "Button",
            variantProperties: [{ name: "variant", values: ["primary"] }],
            componentProperties: [
                { name: "label", type: "TEXT", default: "Click me", bindTo: { layer: "Label" } },
            ],
            children: [
                {
                    type: "COMPONENT",
                    name: "Primary",
                    variantValues: { variant: "primary" },
                    children: [
                        { type: "TEXT", name: "Label", characters: "Click me", textStyle: "$text/body/md" },
                    ],
                },
            ],
        },
    ]);
    strict_1.default.ok(code.includes('.addComponentProperty("label", "TEXT", "Click me")'));
    // The binding must reuse the key Figma returned, not the bare property name.
    strict_1.default.match(code, /componentPropertyReferences = \{ characters: cp_\w+ \}/);
    strict_1.default.ok(code.includes('n.name === "Label"'));
});
(0, node_test_1.test)("a BOOLEAN property defaults to driving visibility", () => {
    const code = emit([
        {
            type: "COMPONENT",
            name: "Badge",
            componentProperties: [
                { name: "showIcon", type: "BOOLEAN", default: false, bindTo: { layer: "Icon" } },
            ],
            children: [],
        },
    ]);
    strict_1.default.ok(code.includes('.addComponentProperty("showIcon", "BOOLEAN", false)'));
    strict_1.default.match(code, /componentPropertyReferences = \{ visible: cp_\w+ \}/);
});
(0, node_test_1.test)("a standalone COMPONENT is created and appended like a frame", () => {
    const code = emit([
        {
            type: "COMPONENT",
            name: "Divider",
            layout: "HORIZONTAL",
            description: "A rule.",
            children: [],
        },
    ]);
    strict_1.default.ok(code.includes("figma.createComponent()"));
    strict_1.default.ok(code.includes('.name = "Divider"'));
    strict_1.default.ok(code.includes('.layoutMode = "HORIZONTAL"'));
    strict_1.default.ok(code.includes('.description = "A rule."'));
    strict_1.default.ok(code.includes("root.appendChild("));
    strict_1.default.ok(!code.includes("combineAsVariants"));
});
(0, node_test_1.test)("an empty component set warns instead of emitting a broken combine", () => {
    const code = emit([
        {
            type: "COMPONENT_SET",
            name: "Empty",
            variantProperties: [{ name: "variant", values: ["a"] }],
            children: [],
        },
    ]);
    strict_1.default.ok(code.includes("// WARN"));
    strict_1.default.ok(!code.includes("combineAsVariants"));
});
//# sourceMappingURL=component.test.js.map