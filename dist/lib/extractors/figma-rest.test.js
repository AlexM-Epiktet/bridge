"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const figma_rest_js_1 = require("./figma-rest.js");
function mockFetch(responsesByUrl) {
    return (async (url) => {
        const key = String(url);
        const body = responsesByUrl[key];
        if (!body)
            throw new Error(`unmocked url: ${key}`);
        return {
            ok: true,
            status: 200,
            async json() {
                return body;
            },
        };
    });
}
function recordingFetch(responsesByUrl) {
    const urls = [];
    const fetchImpl = (async (url) => {
        const key = String(url);
        urls.push(key);
        const body = responsesByUrl[key];
        if (!body)
            throw new Error(`unmocked url: ${key}`);
        return {
            ok: true,
            status: 200,
            async json() {
                return body;
            },
        };
    });
    return { fetchImpl, urls };
}
(0, node_test_1.test)("extractFromFigma normalizes REST responses", async () => {
    const FIX = node_path_1.default.resolve("test/fixtures/figma-rest");
    const v = JSON.parse(await (0, promises_1.readFile)(node_path_1.default.join(FIX, "variables-response.json"), "utf8"));
    const c = JSON.parse(await (0, promises_1.readFile)(node_path_1.default.join(FIX, "components-response.json"), "utf8"));
    const cs = JSON.parse(await (0, promises_1.readFile)(node_path_1.default.join(FIX, "component-sets-response.json"), "utf8"));
    const n = JSON.parse(await (0, promises_1.readFile)(node_path_1.default.join(FIX, "nodes-response.json"), "utf8"));
    const s = JSON.parse(await (0, promises_1.readFile)(node_path_1.default.join(FIX, "styles-response.json"), "utf8"));
    const fetchMock = mockFetch({
        "https://api.figma.com/v1/files/FILEKEY/variables/local": v,
        "https://api.figma.com/v1/files/FILEKEY/components": c,
        "https://api.figma.com/v1/files/FILEKEY/component_sets": cs,
        "https://api.figma.com/v1/files/FILEKEY/nodes?ids=1%3A100&depth=1": n,
        "https://api.figma.com/v1/files/FILEKEY/styles": s,
    });
    const result = await (0, figma_rest_js_1.extractFromFigma)({
        fileKey: "FILEKEY",
        token: "figd_test",
        fetchImpl: fetchMock,
    });
    strict_1.default.equal(result.variables.variables.length, 1);
    strict_1.default.equal(result.variables.variables[0].name, "color/bg/primary");
    strict_1.default.equal(result.variables.variables[0].key, "VAR_KEY_1");
    strict_1.default.ok(result.variables.variables[0].valuesByMode.light);
    // The Button COMPONENT_SET enriched from /nodes, plus the standalone
    // "Divider" component. The Button variant instance (1:101) is filtered
    // out because it carries component_set_id.
    const comps = result.components.components;
    strict_1.default.equal(comps.length, 2);
    const btn = comps.find((c) => c.name === "Button");
    strict_1.default.equal(btn.type, "COMPONENT_SET");
    strict_1.default.equal(btn.key, "SETKEY_BTN");
    strict_1.default.equal(btn.variants, 6);
    strict_1.default.equal(btn.properties["variant"], "VARIANT(primary,secondary,tertiary)");
    strict_1.default.equal(btn.properties["size"], "VARIANT(large,medium,small)");
    strict_1.default.equal(btn.properties["hasIcon#1345:0"], "BOOLEAN");
    strict_1.default.equal(btn.properties["label#1057:0"], "TEXT");
    const divider = comps.find((c) => c.name === "Divider");
    strict_1.default.equal(divider.type, "COMPONENT");
    strict_1.default.deepEqual(divider.properties, {});
    strict_1.default.equal(result.textStyles.styles.length, 1);
    strict_1.default.equal(result.textStyles.styles[0].name, "label/md");
});
(0, node_test_1.test)("extractFromFigma throws on missing token", async () => {
    await strict_1.default.rejects(() => (0, figma_rest_js_1.extractFromFigma)({ fileKey: "x", token: "" }));
});
(0, node_test_1.test)("extractComponentsFromFigma fetches components + component_sets + /nodes for property defs", async () => {
    const FIX = node_path_1.default.resolve("test/fixtures/figma-rest");
    const c = JSON.parse(await (0, promises_1.readFile)(node_path_1.default.join(FIX, "components-response.json"), "utf8"));
    const cs = JSON.parse(await (0, promises_1.readFile)(node_path_1.default.join(FIX, "component-sets-response.json"), "utf8"));
    const n = JSON.parse(await (0, promises_1.readFile)(node_path_1.default.join(FIX, "nodes-response.json"), "utf8"));
    const { fetchImpl, urls } = recordingFetch({
        "https://api.figma.com/v1/files/FILEKEY/components": c,
        "https://api.figma.com/v1/files/FILEKEY/component_sets": cs,
        "https://api.figma.com/v1/files/FILEKEY/nodes?ids=1%3A100&depth=1": n,
    });
    const reg = await (0, figma_rest_js_1.extractComponentsFromFigma)({
        fileKey: "FILEKEY",
        token: "figd_test",
        fetchImpl,
    });
    // Exactly the three endpoints the extractor needs, in any order.
    strict_1.default.equal(urls.length, 3);
    strict_1.default.ok(urls.some((u) => u.endsWith("/components")));
    strict_1.default.ok(urls.some((u) => u.endsWith("/component_sets")));
    strict_1.default.ok(urls.some((u) => u.includes("/nodes?ids=")));
    // Output has both the enriched COMPONENT_SET and the standalone COMPONENT.
    strict_1.default.equal(reg.components.length, 2);
});
(0, node_test_1.test)("extractComponentsFromFigma filters orphan variants by name heuristic", async () => {
    // Some Figma libraries publish variants individually without a parent SET.
    // The node-ID dedup can't catch those (no /component_sets entry exists),
    // so we fall back to Figma's variant-naming convention (`key=value`).
    const { fetchImpl } = recordingFetch({
        "https://api.figma.com/v1/files/FILEKEY/components": {
            meta: {
                components: [
                    {
                        key: "ORPHAN_K1",
                        name: "trend=positive, layout=expanded",
                        node_id: "5:1",
                        containing_frame: { pageName: "Trend" },
                    },
                    {
                        key: "REAL_K",
                        name: "RecommendationCard",
                        node_id: "5:2",
                        containing_frame: { pageName: "Cards" },
                    },
                ],
            },
        },
        "https://api.figma.com/v1/files/FILEKEY/component_sets": {
            meta: { component_sets: [] },
        },
    });
    const reg = await (0, figma_rest_js_1.extractComponentsFromFigma)({
        fileKey: "FILEKEY",
        token: "figd_test",
        fetchImpl,
    });
    const comps = reg.components;
    strict_1.default.equal(comps.length, 1);
    strict_1.default.equal(comps[0].name, "RecommendationCard");
});
(0, node_test_1.test)("extractComponentsFromFigma deduplicates variants against /component_sets children", async () => {
    // The Figma /components endpoint returns every variant inside a SET as a
    // standalone entry (and does NOT include a componentSetId field). We must
    // dedupe by checking each /components node_id against the children list
    // returned by /nodes for each SET. Otherwise the KB inflates 20x with
    // variant rows.
    const { fetchImpl } = recordingFetch({
        "https://api.figma.com/v1/files/FILEKEY/components": {
            meta: {
                components: [
                    {
                        key: "VARIANT_KEY_1",
                        name: "variant=primary, size=medium",
                        node_id: "1:101",
                        containing_frame: { pageName: "Actions" },
                    },
                    {
                        key: "VARIANT_KEY_2",
                        name: "variant=secondary, size=large",
                        node_id: "1:102",
                        containing_frame: { pageName: "Actions" },
                    },
                    {
                        key: "STANDALONE_KEY",
                        name: "Divider",
                        node_id: "9:9",
                        containing_frame: { pageName: "Layout" },
                    },
                ],
            },
        },
        "https://api.figma.com/v1/files/FILEKEY/component_sets": {
            meta: {
                component_sets: [
                    {
                        key: "SETKEY_BTN",
                        name: "Button",
                        node_id: "1:100",
                        containing_frame: { pageName: "Actions" },
                    },
                ],
            },
        },
        "https://api.figma.com/v1/files/FILEKEY/nodes?ids=1%3A100&depth=1": {
            nodes: {
                "1:100": {
                    document: {
                        id: "1:100",
                        type: "COMPONENT_SET",
                        name: "Button",
                        children: [
                            { id: "1:101", type: "COMPONENT" },
                            { id: "1:102", type: "COMPONENT" },
                        ],
                        componentPropertyDefinitions: {
                            variant: { type: "VARIANT", variantOptions: ["primary", "secondary"] },
                            size: { type: "VARIANT", variantOptions: ["medium", "large"] },
                        },
                    },
                },
            },
        },
    });
    const reg = await (0, figma_rest_js_1.extractComponentsFromFigma)({
        fileKey: "FILEKEY",
        token: "figd_test",
        fetchImpl,
    });
    // Should be exactly 2: the Button SET + the standalone Divider. The two
    // variant rows (1:101 and 1:102) are filtered out because they appear in
    // the SET's children list.
    const comps = reg.components;
    strict_1.default.equal(comps.length, 2);
    strict_1.default.ok(comps.find((c) => c.name === "Button" && c.type === "COMPONENT_SET"));
    strict_1.default.ok(comps.find((c) => c.name === "Divider" && c.type === "COMPONENT"));
    strict_1.default.ok(!comps.find((c) => c.name.includes("variant=primary")));
    strict_1.default.ok(!comps.find((c) => c.name.includes("variant=secondary")));
});
(0, node_test_1.test)("extractComponentsFromFigma skips the /nodes call when no component sets exist", async () => {
    // Files with only standalone components shouldn't pay the cost of a /nodes
    // request — verify that the extractor's 2-pass logic short-circuits cleanly.
    const { fetchImpl, urls } = recordingFetch({
        "https://api.figma.com/v1/files/FILEKEY/components": {
            meta: { components: [{ key: "K", name: "Solo", node_id: "1:1" }] },
        },
        "https://api.figma.com/v1/files/FILEKEY/component_sets": {
            meta: { component_sets: [] },
        },
    });
    const reg = await (0, figma_rest_js_1.extractComponentsFromFigma)({
        fileKey: "FILEKEY",
        token: "figd_test",
        fetchImpl,
    });
    strict_1.default.equal(urls.length, 2);
    strict_1.default.ok(!urls.some((u) => u.includes("/nodes")));
    strict_1.default.equal(reg.components.length, 1);
});
(0, node_test_1.test)("extractVariablesFromFigma only hits /variables/local endpoint", async () => {
    const FIX = node_path_1.default.resolve("test/fixtures/figma-rest");
    const v = JSON.parse(await (0, promises_1.readFile)(node_path_1.default.join(FIX, "variables-response.json"), "utf8"));
    const { fetchImpl, urls } = recordingFetch({
        "https://api.figma.com/v1/files/FILEKEY/variables/local": v,
    });
    const reg = await (0, figma_rest_js_1.extractVariablesFromFigma)({
        fileKey: "FILEKEY",
        token: "figd_test",
        fetchImpl,
    });
    strict_1.default.equal(urls.length, 1);
    strict_1.default.match(urls[0], /\/variables\/local$/);
    strict_1.default.equal(reg.variables.length, 1);
});
(0, node_test_1.test)("extractVariablesFromFigma throws VariablesEndpointUnavailableError on 403", async () => {
    const { VariablesEndpointUnavailableError } = await import("./figma-rest.js");
    const fetchImpl = (async () => {
        return {
            ok: false,
            status: 403,
            async json() {
                return {};
            },
        };
    });
    await strict_1.default.rejects(() => (0, figma_rest_js_1.extractVariablesFromFigma)({ fileKey: "X", token: "t", fetchImpl }), (err) => err instanceof VariablesEndpointUnavailableError);
});
(0, node_test_1.test)("extractVariablesFromFigma throws VariablesEndpointUnavailableError on 404", async () => {
    const { VariablesEndpointUnavailableError } = await import("./figma-rest.js");
    const fetchImpl = (async () => {
        return {
            ok: false,
            status: 404,
            async json() {
                return {};
            },
        };
    });
    await strict_1.default.rejects(() => (0, figma_rest_js_1.extractVariablesFromFigma)({ fileKey: "X", token: "t", fetchImpl }), (err) => err instanceof VariablesEndpointUnavailableError);
});
(0, node_test_1.test)("extractVariablesFromFigma rethrows other HTTP errors as generic Error", async () => {
    const fetchImpl = (async () => {
        return {
            ok: false,
            status: 500,
            async json() {
                return {};
            },
        };
    });
    await strict_1.default.rejects(() => (0, figma_rest_js_1.extractVariablesFromFigma)({ fileKey: "X", token: "t", fetchImpl }), /failed: 500/);
});
(0, node_test_1.test)("extractTextStylesFromFigma only hits /styles endpoint", async () => {
    const FIX = node_path_1.default.resolve("test/fixtures/figma-rest");
    const s = JSON.parse(await (0, promises_1.readFile)(node_path_1.default.join(FIX, "styles-response.json"), "utf8"));
    const { fetchImpl, urls } = recordingFetch({
        "https://api.figma.com/v1/files/FILEKEY/styles": s,
    });
    const reg = await (0, figma_rest_js_1.extractTextStylesFromFigma)({
        fileKey: "FILEKEY",
        token: "figd_test",
        fetchImpl,
    });
    strict_1.default.equal(urls.length, 1);
    strict_1.default.match(urls[0], /\/styles$/);
    strict_1.default.equal(reg.styles.length, 1);
});
//# sourceMappingURL=figma-rest.test.js.map