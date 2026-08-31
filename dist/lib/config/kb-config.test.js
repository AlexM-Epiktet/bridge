"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const kb_config_js_1 = require("./kb-config.js");
(0, node_test_1.test)("parseKBConfig accepts minimal config with defaults", async () => {
    const raw = await (0, promises_1.readFile)(node_path_1.default.resolve("test/fixtures/kb-config/minimal.yaml"), "utf8");
    const cfg = (0, kb_config_js_1.parseKBConfig)(raw);
    strict_1.default.equal(cfg.dsName, "Spectra");
    strict_1.default.equal(cfg.kbPath, "bridge-ds");
    strict_1.default.equal(cfg.cron.cadence, "daily");
    strict_1.default.equal(cfg.cron.time, "06:00");
    strict_1.default.deepEqual(cfg.figmaFiles, {});
});
(0, node_test_1.test)("parseKBConfig accepts full config", async () => {
    const raw = await (0, promises_1.readFile)(node_path_1.default.resolve("test/fixtures/kb-config/full.yaml"), "utf8");
    const cfg = (0, kb_config_js_1.parseKBConfig)(raw);
    strict_1.default.equal(cfg.tagline, "Finary's design system.");
    strict_1.default.equal(cfg.kbPath, "bridge-ds");
});
(0, node_test_1.test)("parseKBConfig throws on missing required field", () => {
    strict_1.default.throws(() => (0, kb_config_js_1.parseKBConfig)("dsName: Spectra\n"));
});
(0, node_test_1.test)("parseKBConfig throws on empty dsName", () => {
    strict_1.default.throws(() => (0, kb_config_js_1.parseKBConfig)('dsName: ""\nfigmaFileKey: abc\n'));
});
(0, node_test_1.test)("parseKBConfig rejects custom YAML tags (defense-in-depth)", () => {
    strict_1.default.throws(() => (0, kb_config_js_1.parseKBConfig)('dsName: x\nfigmaFileKey: y\nkbPath: !!js/function "() => 1"\n'));
});
(0, node_test_1.test)("parseKBConfig accepts per-category figmaFiles overrides", async () => {
    const raw = await (0, promises_1.readFile)(node_path_1.default.resolve("test/fixtures/kb-config/multi-file.yaml"), "utf8");
    const cfg = (0, kb_config_js_1.parseKBConfig)(raw);
    strict_1.default.equal(cfg.figmaFileKey, "COMPONENTS_FILE");
    strict_1.default.equal(cfg.figmaFiles.variables, "FOUNDATIONS_FILE");
    strict_1.default.equal(cfg.figmaFiles.textStyles, "FOUNDATIONS_FILE");
    strict_1.default.equal(cfg.figmaFiles.components, undefined);
});
(0, node_test_1.test)("resolveFileKey returns the override when present, else the primary key", () => {
    const cfg = (0, kb_config_js_1.parseKBConfig)(`dsName: x\nfigmaFileKey: PRIMARY\nfigmaFiles:\n  variables: OVERRIDE\n`);
    strict_1.default.equal((0, kb_config_js_1.resolveFileKey)(cfg, "variables"), "OVERRIDE");
    strict_1.default.equal((0, kb_config_js_1.resolveFileKey)(cfg, "components"), "PRIMARY");
    strict_1.default.equal((0, kb_config_js_1.resolveFileKey)(cfg, "textStyles"), "PRIMARY");
});
(0, node_test_1.test)("resolveFileKey falls back to primary when figmaFiles is omitted", () => {
    const cfg = (0, kb_config_js_1.parseKBConfig)(`dsName: x\nfigmaFileKey: PRIMARY\n`);
    strict_1.default.equal((0, kb_config_js_1.resolveFileKey)(cfg, "components"), "PRIMARY");
    strict_1.default.equal((0, kb_config_js_1.resolveFileKey)(cfg, "variables"), "PRIMARY");
    strict_1.default.equal((0, kb_config_js_1.resolveFileKey)(cfg, "textStyles"), "PRIMARY");
});
//# sourceMappingURL=kb-config.test.js.map