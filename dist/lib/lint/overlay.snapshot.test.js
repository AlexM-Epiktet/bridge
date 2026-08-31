"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_path_1 = __importDefault(require("node:path"));
const promises_1 = require("node:fs/promises");
const loader_js_1 = require("./loader.js");
const overlay_js_1 = require("./overlay.js");
(0, node_test_1.test)("snapshot: overlay for archetype:card with finary config", async () => {
    const config = await (0, loader_js_1.loadConfig)("test/fixtures/lint/finary.yaml");
    strict_1.default.ok(config?.rules);
    const rules = Object.fromEntries(Object.entries(config.rules).filter(([, r]) => r !== "off"));
    const actual = (0, overlay_js_1.renderSkillOverlay)({
        rules: rules,
        request: { archetype: "card" },
    });
    const snapshotPath = node_path_1.default.resolve("test/snapshots/overlay-card.xml");
    let expected;
    try {
        expected = await (0, promises_1.readFile)(snapshotPath, "utf-8");
    }
    catch {
        // First run: emit snapshot
        await (0, promises_1.mkdir)(node_path_1.default.dirname(snapshotPath), { recursive: true });
        await (0, promises_1.writeFile)(snapshotPath, actual, "utf-8");
        expected = actual;
    }
    // The snapshot is compared line-ending-agnostically: git checks this fixture
    // out with CRLF on Windows while the renderer always emits LF, so a literal
    // comparison fails on that platform for a difference nobody authored.
    strict_1.default.equal(normalizeEol(actual).trim(), normalizeEol(expected).trim());
});
function normalizeEol(value) {
    return value.replace(/\r\n/g, "\n");
}
//# sourceMappingURL=overlay.snapshot.test.js.map