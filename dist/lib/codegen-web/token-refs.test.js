"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const token_refs_js_1 = require("./token-refs.js");
/** Minimal TokenValueIndex builder — only the fields buildTokenRefs reads. */
function index(variables, theme = [], themeCssFile = null) {
    const themeByName = new Map();
    const themeByKey = new Map();
    for (const t of theme) {
        if (t.figmaName)
            themeByName.set(t.figmaName, t);
        if (t.figmaKey)
            themeByKey.set(t.figmaKey, t);
    }
    return {
        variables,
        variableByName: new Map(variables.map((v) => [v.name, v])),
        variableByKey: new Map(variables.map((v) => [v.key, v])),
        textStyles: [],
        textStyleByName: new Map(),
        textStyleByKey: new Map(),
        themeByName,
        themeByKey,
        themeCssFile,
        modes: ["light"],
        defaultMode: "light",
        warnings: [],
    };
}
(0, node_test_1.test)("a token bound in the theme lockfile resolves to the existing custom property", () => {
    const refs = (0, token_refs_js_1.buildTokenRefs)(index([{ key: "K1", name: "main/color/primary/primary", resolvedType: "COLOR", valuesByMode: {} }], [
        {
            cssVar: "--color-primary",
            figmaName: "main/color/primary/primary",
            figmaKey: "K1",
            cssValue: "oklch(52.2% 0.216 268.352)",
        },
    ]));
    const ref = refs.byName.get("main/color/primary/primary");
    strict_1.default.equal(ref?.reference, "var(--color-primary)");
    strict_1.default.equal(ref?.source, "theme-lockfile");
    strict_1.default.equal(refs.needsGeneratedStylesheet, false);
    strict_1.default.deepEqual(refs.unbound, []);
});
(0, node_test_1.test)("a token with KB values resolves to a generated custom property", () => {
    const refs = (0, token_refs_js_1.buildTokenRefs)(index([
        {
            key: "K2",
            name: "spacing/md",
            resolvedType: "FLOAT",
            valuesByMode: { light: { kind: "number", value: 16 } },
        },
    ]));
    const ref = refs.byName.get("spacing/md");
    strict_1.default.equal(ref?.reference, "var(--spacing-md)");
    strict_1.default.equal(ref?.source, "generated");
    strict_1.default.equal(refs.needsGeneratedStylesheet, true);
});
(0, node_test_1.test)("the lockfile wins over generated values for the same token", () => {
    const refs = (0, token_refs_js_1.buildTokenRefs)(index([
        {
            key: "K1",
            name: "main/color/base/100",
            resolvedType: "COLOR",
            valuesByMode: { light: { kind: "color", hex: "#ffffff", alpha: 1 } },
        },
    ], [{ cssVar: "--color-base-100", figmaKey: "K1", cssValue: "oklch(98.1% 0.003 228.784)" }]));
    strict_1.default.equal(refs.byName.get("main/color/base/100")?.source, "theme-lockfile");
    strict_1.default.equal(refs.needsGeneratedStylesheet, false);
});
(0, node_test_1.test)("a token with neither a value nor a binding is reported unbound, never guessed", () => {
    const refs = (0, token_refs_js_1.buildTokenRefs)(index([{ key: "K3", name: "space/gap/md", resolvedType: "FLOAT", valuesByMode: {} }]));
    strict_1.default.equal(refs.byName.has("space/gap/md"), false);
    strict_1.default.equal(refs.unbound.length, 1);
    strict_1.default.equal(refs.unbound[0]?.token, "space/gap/md");
    strict_1.default.match(refs.unbound[0].reason, /unknown to the knowledge base/);
});
(0, node_test_1.test)("lockfile entries absent from variables.json are still usable", () => {
    const refs = (0, token_refs_js_1.buildTokenRefs)(index([], [{ cssVar: "--radius-box", figmaName: "radius/box", cssValue: "0.5rem" }]));
    strict_1.default.equal(refs.byName.get("radius/box")?.reference, "var(--radius-box)");
});
(0, node_test_1.test)("refFor matches by key first, then by name, and tolerates the $ prefix", () => {
    const refs = (0, token_refs_js_1.buildTokenRefs)(index([
        {
            key: "K1",
            name: "color/bg/primary",
            resolvedType: "COLOR",
            valuesByMode: { light: { kind: "color", hex: "#0066ff", alpha: 1 } },
        },
    ]));
    strict_1.default.equal((0, token_refs_js_1.refFor)(refs, { key: "K1", name: "color/bg/primary" })?.cssVar, "--color-bg-primary");
    strict_1.default.equal((0, token_refs_js_1.refFor)(refs, "color/bg/primary")?.cssVar, "--color-bg-primary");
    strict_1.default.equal((0, token_refs_js_1.refFor)(refs, "$color/bg/primary")?.cssVar, "--color-bg-primary");
    strict_1.default.equal((0, token_refs_js_1.refFor)(refs, { key: "UNKNOWN" }), null);
    strict_1.default.equal((0, token_refs_js_1.refFor)(refs, null), null);
});
//# sourceMappingURL=token-refs.test.js.map