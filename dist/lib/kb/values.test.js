"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const values_js_1 = require("./values.js");
/** Write a throwaway KB with the given registry files and return its root. */
function makeKB(files) {
    const dir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-values-"));
    const reg = node_path_1.default.join(dir, "knowledge-base", "registries");
    (0, node_fs_1.mkdirSync)(reg, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(reg, name), JSON.stringify(content, null, 2), "utf8");
    }
    return dir;
}
(0, node_test_1.test)("rgbaToHex converts Figma floats to hex and keeps alpha separate", () => {
    strict_1.default.deepEqual((0, values_js_1.rgbaToHex)({ r: 0, g: 0.4, b: 1, a: 1 }), { hex: "#0066ff", alpha: 1 });
    strict_1.default.deepEqual((0, values_js_1.rgbaToHex)({ r: 1, g: 1, b: 1 }), { hex: "#ffffff", alpha: 1 });
    strict_1.default.deepEqual((0, values_js_1.rgbaToHex)({ r: 0, g: 0, b: 0, a: 0.5 }), { hex: "#000000", alpha: 0.5 });
});
(0, node_test_1.test)("rgbaToHex clamps out-of-range channels", () => {
    strict_1.default.equal((0, values_js_1.rgbaToHex)({ r: -1, g: 2, b: 0.5 }).hex, "#00ff80");
});
(0, node_test_1.test)("loadTokenValues resolves colors and numbers per mode", () => {
    const dir = makeKB({
        "variables.json": {
            version: 1,
            variables: [
                {
                    key: "K1",
                    name: "color/bg/primary",
                    resolvedType: "COLOR",
                    valuesByMode: {
                        light: { r: 0, g: 0.4, b: 1, a: 1 },
                        dark: { r: 0.2, g: 0.52, b: 1, a: 1 },
                    },
                },
                {
                    key: "K2",
                    name: "spacing/md",
                    resolvedType: "FLOAT",
                    scopes: ["GAP"],
                    valuesByMode: { light: 16 },
                },
            ],
        },
    });
    try {
        const idx = (0, values_js_1.loadTokenValues)(dir);
        strict_1.default.equal(idx.defaultMode, "light");
        strict_1.default.deepEqual(idx.modes, ["light", "dark"]);
        const color = idx.variableByName.get("color/bg/primary");
        strict_1.default.deepEqual(color?.valuesByMode.light, { kind: "color", hex: "#0066ff", alpha: 1 });
        strict_1.default.deepEqual(color?.valuesByMode.dark, { kind: "color", hex: "#3385ff", alpha: 1 });
        const spacing = idx.variableByName.get("spacing/md");
        strict_1.default.deepEqual(spacing?.valuesByMode.light, { kind: "number", value: 16 });
        strict_1.default.deepEqual(spacing?.scopes, ["GAP"]);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("loadTokenValues follows a VARIABLE_ALIAS chain by id", () => {
    const dir = makeKB({
        "variables.json": {
            variables: [
                {
                    key: "KBASE",
                    id: "VariableID:1:1",
                    name: "palette/blue/500",
                    resolvedType: "COLOR",
                    valuesByMode: { light: { r: 0, g: 0.4, b: 1, a: 1 } },
                },
                {
                    key: "KALIAS",
                    id: "VariableID:1:2",
                    name: "color/bg/primary",
                    resolvedType: "COLOR",
                    valuesByMode: { light: { type: "VARIABLE_ALIAS", id: "VariableID:1:1" } },
                },
            ],
        },
    });
    try {
        const idx = (0, values_js_1.loadTokenValues)(dir);
        strict_1.default.deepEqual(idx.variableByName.get("color/bg/primary")?.valuesByMode.light, {
            kind: "color",
            hex: "#0066ff",
            alpha: 1,
        });
        strict_1.default.equal(idx.warnings.length, 0);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("loadTokenValues reports an alias cycle instead of looping", () => {
    const dir = makeKB({
        "variables.json": {
            variables: [
                {
                    key: "KA",
                    id: "A",
                    name: "a",
                    resolvedType: "COLOR",
                    valuesByMode: { light: { type: "VARIABLE_ALIAS", id: "B" } },
                },
                {
                    key: "KB",
                    id: "B",
                    name: "b",
                    resolvedType: "COLOR",
                    valuesByMode: { light: { type: "VARIABLE_ALIAS", id: "A" } },
                },
            ],
        },
    });
    try {
        const idx = (0, values_js_1.loadTokenValues)(dir);
        strict_1.default.equal(Object.keys(idx.variableByName.get("a").valuesByMode).length, 0);
        strict_1.default.ok(idx.warnings.some((w) => w.includes("alias cycle")));
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("loadTokenValues reports an unresolvable alias target without guessing", () => {
    const dir = makeKB({
        "variables.json": {
            variables: [
                {
                    key: "KA",
                    name: "color/bg/primary",
                    resolvedType: "COLOR",
                    valuesByMode: { light: { type: "VARIABLE_ALIAS", id: "VariableID:9:9" } },
                },
            ],
        },
    });
    try {
        const idx = (0, values_js_1.loadTokenValues)(dir);
        strict_1.default.deepEqual(idx.variableByName.get("color/bg/primary")?.valuesByMode, {});
        strict_1.default.ok(idx.warnings.some((w) => w.includes("not found in the registry")));
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("loadTokenValues flattens the collections-keyed variable shape", () => {
    const dir = makeKB({
        "variables.json": {
            collections: {
                Core: {
                    variables: [
                        { key: "K1", name: "spacing/sm", resolvedType: "FLOAT", valuesByMode: { light: 8 } },
                    ],
                },
            },
        },
    });
    try {
        const idx = (0, values_js_1.loadTokenValues)(dir);
        strict_1.default.equal(idx.variables.length, 1);
        strict_1.default.deepEqual(idx.variableByName.get("spacing/sm")?.valuesByMode.light, {
            kind: "number",
            value: 8,
        });
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("loadTokenValues indexes theme-lockfile bindings by name and key", () => {
    const dir = makeKB({
        "variables.json": {
            variables: [{ key: "K1", name: "main/color/primary/primary", resolvedType: "COLOR" }],
        },
        "theme-values.json": {
            cssFile: "src/theme/amli-theme.css",
            tokens: [
                {
                    cssVar: "--color-primary",
                    figmaName: "main/color/primary/primary",
                    figmaKey: "K1",
                    type: "color",
                    cssValue: "oklch(52.2% 0.216 268.352)",
                },
            ],
        },
    });
    try {
        const idx = (0, values_js_1.loadTokenValues)(dir);
        strict_1.default.equal(idx.themeCssFile, "src/theme/amli-theme.css");
        strict_1.default.equal(idx.themeByName.get("main/color/primary/primary")?.cssVar, "--color-primary");
        strict_1.default.equal(idx.themeByKey.get("K1")?.cssVar, "--color-primary");
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("loadTokenValues flags the placeholder typography fingerprint", () => {
    const dir = makeKB({
        "text-styles.json": {
            styles: [
                {
                    key: "S1",
                    name: "sans/sm",
                    fontFamily: "Inter",
                    fontStyle: "Regular",
                    fontSize: 14,
                    lineHeight: 20,
                },
                {
                    key: "S2",
                    name: "sans/xl",
                    fontFamily: "Inter",
                    fontStyle: "Regular",
                    fontSize: 14,
                    lineHeight: 20,
                },
            ],
        },
    });
    try {
        const idx = (0, values_js_1.loadTokenValues)(dir);
        strict_1.default.equal(idx.textStyles.every((s) => !s.metricsResolved), true);
        strict_1.default.ok(idx.warnings.some((w) => w.includes("pre-7.4 REST extractor")));
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("loadTokenValues keeps genuinely varied typography metrics", () => {
    const dir = makeKB({
        "text-styles.json": {
            styles: [
                {
                    key: "S1",
                    name: "sans/sm",
                    fontFamily: "Inter",
                    fontStyle: "Regular",
                    fontSize: 14,
                    lineHeight: 20,
                },
                {
                    key: "S2",
                    name: "sans/xl",
                    fontFamily: "Inter",
                    fontStyle: "Bold",
                    fontSize: 24,
                    lineHeight: 32,
                },
            ],
        },
    });
    try {
        const idx = (0, values_js_1.loadTokenValues)(dir);
        strict_1.default.equal(idx.textStyles.every((s) => s.metricsResolved), true);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("loadTokenValues on a missing KB yields an empty index, not a throw", () => {
    const idx = (0, values_js_1.loadTokenValues)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-does-not-exist-" + Date.now()));
    strict_1.default.deepEqual(idx.variables, []);
    strict_1.default.deepEqual(idx.textStyles, []);
    strict_1.default.equal(idx.themeCssFile, null);
});
//# sourceMappingURL=values.test.js.map