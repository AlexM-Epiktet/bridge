"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const detokenize_js_1 = require("./detokenize.js");
// ─── Fixtures ─────────────────────────────────────────────────────────────────
const VARIABLES = [
    { name: "spacing/md", key: "var-spacing-md", collection: "" },
    { name: "spacing/lg", key: "var-spacing-lg", collection: "" },
    { name: "color/bg/primary", key: "var-color-bg-primary", collection: "" },
    { name: "color/text/default", key: "var-color-text-default", collection: "" },
    // A KB produced by the MCP extraction path stores the session id in `key`.
    { name: "radius/sm", key: "VariableID:42:7", collection: "" },
];
const TEXT_STYLES = [{ name: "text/heading/xl", key: "style-heading-xl" }];
const COMPONENTS = [
    { name: "Button", key: "comp-button", type: "COMPONENT_SET", properties: {} },
];
function emptyAssetIndex() {
    return { byName: new Map() };
}
/** Minimal Registry matching lib/compiler/registry.ts. `bySegment` is unused by
 * import (it exists for fuzzy forward matching) so it stays empty. */
function makeRegistry() {
    return {
        variables: {
            byName: new Map(VARIABLES.map((v) => [v.name, v])),
            bySegment: new Map(),
        },
        components: {
            byName: new Map(COMPONENTS.map((c) => [c.name.toLowerCase(), c])),
        },
        textStyles: {
            byName: new Map(TEXT_STYLES.map((s) => [s.name, s])),
            bySegment: new Map(),
        },
        icons: emptyAssetIndex(),
        logos: emptyAssetIndex(),
        allVariableNames: VARIABLES.map((v) => v.name),
        allComponentNames: COMPONENTS.map((c) => c.name.toLowerCase()),
        allStyleNames: TEXT_STYLES.map((s) => s.name),
    };
}
/** A tree drawn entirely with design-system tokens. */
function boundTree() {
    return {
        id: "1:1",
        name: "Card",
        type: "FRAME",
        width: 320,
        height: 200,
        layoutMode: "VERTICAL",
        itemSpacing: 16,
        paddingTop: 24,
        primaryAxisSizingMode: "AUTO",
        counterAxisAlignItems: "CENTER",
        clipsContent: true,
        fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
        boundVariables: {
            itemSpacing: { id: "VariableID:1:1", key: "var-spacing-md" },
            paddingTop: { id: "VariableID:1:2", key: "var-spacing-lg" },
            fills: [{ id: "VariableID:1:3", key: "var-color-bg-primary" }],
        },
        children: [
            {
                id: "1:2",
                name: "Title",
                type: "TEXT",
                characters: "Hello",
                textStyleId: "S:abc",
                textStyleKey: "style-heading-xl",
                textAutoResize: "HEIGHT",
                fills: [
                    {
                        type: "SOLID",
                        color: { r: 0, g: 0, b: 0 },
                        boundVariables: { color: { id: "VariableID:1:4", key: "var-color-text-default" } },
                    },
                ],
            },
            {
                id: "1:3",
                name: "Confirm",
                type: "INSTANCE",
                componentKey: "comp-button",
                variantProperties: { variant: "primary", size: "md" },
            },
        ],
    };
}
// ─── Tests ────────────────────────────────────────────────────────────────────
(0, node_test_1.test)("a fully token-bound tree round-trips with zero flags", () => {
    const result = (0, detokenize_js_1.detokenize)(boundTree(), makeRegistry());
    strict_1.default.deepEqual(result.flags, []);
    strict_1.default.equal(result.stats.flagged, 0);
    strict_1.default.equal(result.stats.nodes, 3);
    strict_1.default.equal(result.stats.tokensResolved, 6);
    const root = result.sceneGraph.nodes[0];
    strict_1.default.equal(result.sceneGraph.version, "3.0");
    strict_1.default.deepEqual(result.sceneGraph.metadata, { name: "Card", width: 320, height: 200 });
    strict_1.default.deepEqual(result.sceneGraph.fonts, []);
    strict_1.default.equal(root.type, "FRAME");
    strict_1.default.equal(root.layout, "VERTICAL");
    strict_1.default.equal(root.gap, "$spacing/md");
    strict_1.default.equal(root.paddingTop, "$spacing/lg");
    strict_1.default.equal(root.fill, "$color/bg/primary");
    strict_1.default.equal(root.primaryAxisSizing, "AUTO");
    strict_1.default.equal(root.counterAxisAlign, "CENTER");
    strict_1.default.equal(root.clip, true);
    const [title, confirm] = root.children;
    strict_1.default.equal(title.type, "TEXT");
    strict_1.default.equal(title.characters, "Hello");
    strict_1.default.equal(title.textStyle, "$text/heading/xl");
    strict_1.default.equal(title.fill, "$color/text/default");
    strict_1.default.equal(title.autoResize, "HEIGHT");
    strict_1.default.equal(confirm.type, "INSTANCE");
    strict_1.default.equal(confirm.component, "Button");
    strict_1.default.deepEqual(confirm.variant, { variant: "primary", size: "md" });
});
(0, node_test_1.test)("a raw hex fill produces exactly one flag with suggestion === null", () => {
    const tree = {
        id: "2:1",
        name: "Banner",
        type: "FRAME",
        width: 100,
        height: 50,
        fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }],
    };
    const result = (0, detokenize_js_1.detokenize)(tree, makeRegistry());
    strict_1.default.equal(result.flags.length, 1);
    const [flag] = result.flags;
    strict_1.default.equal(flag.nodeName, "Banner");
    strict_1.default.equal(flag.nodePath, "Banner");
    strict_1.default.equal(flag.field, "fill");
    strict_1.default.equal(flag.rawValue, "#ff0000");
    strict_1.default.equal(flag.suggestion, null);
    strict_1.default.match(flag.reason, /compile will reject it/);
    // The raw value is carried into the node as-is, so the later compile failure
    // points at the real problem instead of a silently-dropped colour.
    strict_1.default.equal(result.sceneGraph.nodes[0].fill, "#ff0000");
    strict_1.default.equal(result.stats.flagged, 1);
});
(0, node_test_1.test)("a binding resolvable only by id still resolves; one resolvable by neither is flagged", () => {
    const tree = {
        id: "3:1",
        name: "Tile",
        type: "FRAME",
        width: 80,
        height: 80,
        layoutMode: "HORIZONTAL",
        cornerRadius: 4,
        itemSpacing: 12,
        boundVariables: {
            // No `key` recorded — only the session-local id, which this KB happens
            // to store in its `key` column.
            cornerRadius: { id: "VariableID:42:7" },
            itemSpacing: { id: "VariableID:99:9", key: "var-that-does-not-exist" },
        },
    };
    const result = (0, detokenize_js_1.detokenize)(tree, makeRegistry());
    const root = result.sceneGraph.nodes[0];
    strict_1.default.equal(root.radius, "$radius/sm");
    strict_1.default.equal(result.flags.length, 1);
    const [flag] = result.flags;
    strict_1.default.equal(flag.field, "gap");
    strict_1.default.equal(flag.rawValue, 12);
    strict_1.default.equal(flag.suggestion, null);
    strict_1.default.match(flag.reason, /session-local variable ids/);
    strict_1.default.match(flag.reason, /library keys/);
    strict_1.default.match(flag.reason, /VariableID:99:9/);
    // The raw number is still carried, so nothing about the design is lost.
    strict_1.default.equal(root.gap, 12);
});
(0, node_test_1.test)("an INSTANCE with an unknown componentKey flags instead of throwing", () => {
    const tree = {
        id: "4:1",
        name: "Row",
        type: "FRAME",
        width: 200,
        height: 40,
        children: [{ id: "4:2", name: "Mystery", type: "INSTANCE", componentKey: "comp-unknown" }],
    };
    const result = (0, detokenize_js_1.detokenize)(tree, makeRegistry());
    strict_1.default.equal(result.flags.length, 1);
    const [flag] = result.flags;
    strict_1.default.equal(flag.field, "component");
    strict_1.default.equal(flag.nodePath, "Row > Mystery");
    strict_1.default.equal(flag.rawValue, "comp-unknown");
    strict_1.default.equal(flag.suggestion, null);
    // The node survives — only its component binding is missing.
    const instance = result.sceneGraph.nodes[0].children[0];
    strict_1.default.equal(instance.type, "INSTANCE");
    strict_1.default.equal(instance.component, undefined);
    strict_1.default.equal(result.stats.nodes, 2);
});
(0, node_test_1.test)("an unknown Figma node type is flagged and skipped", () => {
    const tree = {
        id: "5:1",
        name: "Art",
        type: "FRAME",
        width: 64,
        height: 64,
        children: [
            { id: "5:2", name: "Squiggle", type: "VECTOR" },
            {
                id: "5:3",
                name: "Label",
                type: "TEXT",
                characters: "hi",
                textStyleKey: "style-heading-xl",
            },
        ],
    };
    const result = (0, detokenize_js_1.detokenize)(tree, makeRegistry());
    const typeFlags = result.flags.filter((f) => f.field === "type");
    strict_1.default.equal(typeFlags.length, 1);
    strict_1.default.equal(typeFlags[0].rawValue, "VECTOR");
    strict_1.default.equal(typeFlags[0].nodePath, "Art > Squiggle");
    strict_1.default.match(typeFlags[0].reason, /skipped/);
    const children = result.sceneGraph.nodes[0].children;
    strict_1.default.equal(children.length, 1);
    strict_1.default.equal(children[0].name, "Label");
    // Skipped nodes are reported, never counted as imported.
    strict_1.default.equal(result.stats.nodes, 2);
});
(0, node_test_1.test)("Figma node ids never reach the scene graph", () => {
    const result = (0, detokenize_js_1.detokenize)(boundTree(), makeRegistry());
    const serialized = JSON.stringify(result.sceneGraph);
    strict_1.default.ok(!serialized.includes('"id"'), "scene graph must not carry any id field");
    strict_1.default.ok(!serialized.includes("1:1"), "scene graph must not carry Figma node ids");
});
(0, node_test_1.test)("opts.name overrides the root node name in metadata", () => {
    const result = (0, detokenize_js_1.detokenize)(boundTree(), makeRegistry(), { name: "product-card" });
    strict_1.default.equal(result.sceneGraph.metadata.name, "product-card");
});
//# sourceMappingURL=detokenize.test.js.map