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
const registry_js_1 = require("./registry.js");
// Variables.json on disk uses two shapes in the wild:
//  - Flat:   { version, generatedAt, variables: [{ name, key, ... }] }       (REST extract)
//  - Nested: { meta, collections: { [name]: { variables: [...] } } }         (MCP plugin export)
// The compiler must read both — when REST returns 403 (non-Enterprise plans),
// the only path to refresh variables.json is the MCP plugin, which produces
// the nested shape.
function fixture(variablesJson) {
    const dir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-mcp-shape-"));
    const regDir = node_path_1.default.join(dir, "knowledge-base", "registries");
    (0, node_fs_1.mkdirSync)(regDir, { recursive: true });
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "components.json"), JSON.stringify({ version: 1, components: [] }));
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "variables.json"), JSON.stringify(variablesJson));
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "text-styles.json"), JSON.stringify({ styles: [] }));
    return dir;
}
(0, node_test_1.test)("loadRegistry reads the MCP-native variables.json shape (collections)", () => {
    const dir = fixture({
        meta: { source: "Foundations", totalVariables: 2 },
        collections: {
            layout: {
                variables: [
                    { name: "layout/spacing/medium", key: "spacing_med_key", valuesByMode: { value: 16 } },
                    { name: "layout/radius/medium", key: "radius_med_key", valuesByMode: { value: 12 } },
                ],
            },
            color: {
                variables: [
                    { name: "color/background/surface/subtle", key: "surface_subtle_key", valuesByMode: {} },
                ],
            },
        },
    });
    try {
        const reg = (0, registry_js_1.loadRegistry)(dir);
        strict_1.default.equal(reg.variables.byName.get("layout/spacing/medium")?.key, "spacing_med_key");
        strict_1.default.equal(reg.variables.byName.get("layout/radius/medium")?.key, "radius_med_key");
        strict_1.default.equal(reg.variables.byName.get("color/background/surface/subtle")?.key, "surface_subtle_key");
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("loadRegistry still reads the flat variables.json shape (REST extract)", () => {
    const dir = fixture({
        version: 1,
        generatedAt: "2026-05-18T00:00:00Z",
        variables: [
            { name: "layout/spacing/medium", key: "spacing_med_key" },
            { name: "layout/radius/medium", key: "radius_med_key" },
        ],
    });
    try {
        const reg = (0, registry_js_1.loadRegistry)(dir);
        strict_1.default.equal(reg.variables.byName.get("layout/spacing/medium")?.key, "spacing_med_key");
        strict_1.default.equal(reg.variables.byName.get("layout/radius/medium")?.key, "radius_med_key");
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
//# sourceMappingURL=registry.mcp-shape.test.js.map