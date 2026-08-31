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
const registry_io_js_1 = require("./registry-io.js");
const orchestrator_js_1 = require("../cron/orchestrator.js");
const registry_js_1 = require("../compiler/registry.js");
function makeKB(components) {
    const dir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-localcomp-"));
    const reg = node_path_1.default.join(dir, "knowledge-base", "registries");
    (0, node_fs_1.mkdirSync)(reg, { recursive: true });
    const file = node_path_1.default.join(reg, "components.json");
    (0, node_fs_1.writeFileSync)(file, JSON.stringify({ version: 1, generatedAt: "2026-01-01T00:00:00Z", components }, null, 2), "utf8");
    return { dir, file };
}
function readComponents(file) {
    return JSON.parse((0, node_fs_1.readFileSync)(file, "utf8")).components;
}
const localButton = {
    key: "LOCAL1",
    name: "Button",
    type: "COMPONENT_SET",
    properties: { variant: (0, registry_io_js_1.encodeVariantAxis)(["primary", "secondary"]) },
    source: "local",
    registeredAt: "2026-08-19T00:00:00Z",
};
(0, node_test_1.test)("encodeVariantAxis writes the shape the compiler's variant validator reads", () => {
    strict_1.default.equal((0, registry_io_js_1.encodeVariantAxis)(["primary", "secondary"]), "VARIANT(primary,secondary)");
});
(0, node_test_1.test)("upsert inserts a new component and bumps generatedAt", async () => {
    const { dir, file } = makeKB([]);
    try {
        const before = JSON.parse((0, node_fs_1.readFileSync)(file, "utf8")).generatedAt;
        const result = await (0, registry_io_js_1.upsertComponentEntry)(file, localButton);
        strict_1.default.equal(result.action, "inserted");
        strict_1.default.equal(result.total, 1);
        strict_1.default.notEqual(JSON.parse((0, node_fs_1.readFileSync)(file, "utf8")).generatedAt, before);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("upsert replaces by key rather than accumulating duplicates", async () => {
    const { dir, file } = makeKB([localButton]);
    try {
        const result = await (0, registry_io_js_1.upsertComponentEntry)(file, { ...localButton, name: "Button v2" });
        strict_1.default.equal(result.action, "replaced");
        strict_1.default.equal(readComponents(file).length, 1);
        strict_1.default.equal(readComponents(file)[0]?.name, "Button v2");
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("upsert replaces by name when the component was re-created with a new key", async () => {
    const { dir, file } = makeKB([localButton]);
    try {
        // Re-creating a component in Figma yields a new key but the same name;
        // without the name fallback the stale entry would linger and could win
        // resolution.
        const result = await (0, registry_io_js_1.upsertComponentEntry)(file, { ...localButton, key: "LOCAL2" });
        strict_1.default.equal(result.action, "replaced");
        const components = readComponents(file);
        strict_1.default.equal(components.length, 1);
        strict_1.default.equal(components[0]?.key, "LOCAL2");
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("a locally registered component is resolvable by the compiler immediately", async () => {
    const { dir, file } = makeKB([]);
    try {
        await (0, registry_io_js_1.upsertComponentEntry)(file, localButton);
        const registry = (0, registry_js_1.loadRegistry)(dir);
        const entry = registry.components.byName.get("button");
        strict_1.default.ok(entry, "the component must be in the registry before any cron run");
        // The encoded property shape is what keeps variant validation working.
        strict_1.default.equal(entry?.properties?.variant, "VARIANT(primary,secondary)");
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
// ─── Cron survival ───────────────────────────────────────────────────────────
(0, node_test_1.test)("a cron refresh preserves a local component the REST result cannot contain", async () => {
    const { dir, file } = makeKB([localButton]);
    try {
        const fresh = {
            version: 1,
            components: [{ key: "PUB1", name: "Card", type: "COMPONENT_SET" }],
        };
        const merged = await (0, orchestrator_js_1.mergeLocalComponents)(file, fresh);
        const names = merged.registry.components.map((c) => c.name);
        strict_1.default.deepEqual(names.sort(), ["Button", "Card"]);
        strict_1.default.equal(merged.preserved, 1);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("publishing promotes a local component instead of duplicating it", async () => {
    const { dir, file } = makeKB([localButton]);
    try {
        // Same key, now returned by Figma: the published entry is authoritative.
        const fresh = {
            version: 1,
            components: [{ key: "LOCAL1", name: "Button", type: "COMPONENT_SET" }],
        };
        const merged = await (0, orchestrator_js_1.mergeLocalComponents)(file, fresh);
        const components = merged.registry.components;
        strict_1.default.equal(components.length, 1);
        strict_1.default.equal(components[0]?.source, undefined, "the published entry replaces the local one");
        strict_1.default.equal(merged.preserved, 0);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("a cron refresh grafts hand-maintained code bindings back on", async () => {
    const bound = {
        key: "PUB1",
        name: "am-table",
        type: "COMPONENT_SET",
        angular: { selector: "am-table", lib: "@amelis/foundation/web-ui", kind: "component" },
    };
    const { dir, file } = makeKB([bound]);
    try {
        // REST has no notion of the Angular binding, so a naive overwrite drops it.
        const fresh = {
            version: 1,
            components: [{ key: "PUB1", name: "am-table", type: "COMPONENT_SET" }],
        };
        const merged = await (0, orchestrator_js_1.mergeLocalComponents)(file, fresh);
        const entry = merged.registry.components[0];
        strict_1.default.deepEqual(entry?.angular, bound.angular);
        strict_1.default.equal(merged.preserved, 1);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("merging against an unreadable previous file still writes the fresh result", async () => {
    const dir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-localcomp-missing-"));
    try {
        const fresh = { version: 1, components: [{ key: "PUB1", name: "Card" }] };
        const merged = await (0, orchestrator_js_1.mergeLocalComponents)(node_path_1.default.join(dir, "nope.json"), fresh);
        strict_1.default.equal(merged.registry.components.length, 1);
        strict_1.default.equal(merged.preserved, 0);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
//# sourceMappingURL=local-components.test.js.map