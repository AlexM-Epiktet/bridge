"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const setup_orchestrator_js_1 = require("./setup-orchestrator.js");
async function exists(p) {
    try {
        await (0, promises_1.access)(p);
        return true;
    }
    catch {
        return false;
    }
}
async function withTempDir(fn) {
    const cwd = process.cwd();
    const dir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-setup-"));
    process.chdir(dir);
    try {
        return await fn(dir);
    }
    finally {
        process.chdir(cwd);
    }
}
(0, node_test_1.test)("scaffold creates the expected directory tree with defaults", async () => {
    await withTempDir(async (dir) => {
        const created = await (0, setup_orchestrator_js_1.scaffold)({ dsName: "Spectra", figmaFileKey: "KEY123" });
        // Expected files and directories are returned in the `created` list
        // AND physically exist on disk.
        for (const relPath of ["docs.config.yaml", ".github/workflows/bridge-kb-cron.yml"]) {
            strict_1.default.ok(created.includes(relPath), `created list missing ${relPath}`);
            strict_1.default.ok(await exists(node_path_1.default.join(dir, relPath)), `${relPath} not on disk`);
        }
        for (const dirPath of [
            "bridge-ds/knowledge-base/registries/",
            "bridge-ds/knowledge-base/recipes/",
            ".bridge/",
            ".github/workflows/",
        ]) {
            strict_1.default.ok(created.includes(dirPath), `created list missing ${dirPath}`);
        }
    });
});
(0, node_test_1.test)("scaffold respects custom kbPath", async () => {
    await withTempDir(async (dir) => {
        const created = await (0, setup_orchestrator_js_1.scaffold)({
            dsName: "Custom",
            figmaFileKey: "K",
            kbPath: "custom-kb",
        });
        strict_1.default.ok(await exists(node_path_1.default.join(dir, "custom-kb", "knowledge-base", "registries")));
        strict_1.default.ok(created.some((p) => p.startsWith("custom-kb/")));
    });
});
(0, node_test_1.test)("scaffold writes a docs.config.yaml that embeds the dsName and key", async () => {
    await withTempDir(async (dir) => {
        await (0, setup_orchestrator_js_1.scaffold)({ dsName: "Acme", figmaFileKey: "abc123" });
        const yaml = await (0, promises_1.readFile)(node_path_1.default.join(dir, "docs.config.yaml"), "utf8");
        strict_1.default.match(yaml, /dsName: "Acme"/);
        strict_1.default.match(yaml, /figmaFileKey: "abc123"/);
        strict_1.default.match(yaml, /cadence: "daily"/);
    });
});
(0, node_test_1.test)("scaffold creates .bridge/ directory for cron reports", async () => {
    await withTempDir(async (dir) => {
        await (0, setup_orchestrator_js_1.scaffold)({ dsName: "X", figmaFileKey: "Y" });
        strict_1.default.ok(await exists(node_path_1.default.join(dir, ".bridge")));
    });
});
(0, node_test_1.test)("scaffold produces a cron workflow with the daily schedule", async () => {
    await withTempDir(async (dir) => {
        await (0, setup_orchestrator_js_1.scaffold)({ dsName: "X", figmaFileKey: "Y" });
        const yml = await (0, promises_1.readFile)(node_path_1.default.join(dir, ".github/workflows/bridge-kb-cron.yml"), "utf8");
        strict_1.default.match(yml, /Bridge KB — Daily Sync/);
        strict_1.default.match(yml, /schedule:\s*-\s*cron: "0 6 \* \* \*"/);
        strict_1.default.match(yml, /secrets\.FIGMA_TOKEN/);
        strict_1.default.match(yml, /npx -y @kinougarde\/bridge-ds@/);
    });
});
(0, node_test_1.test)("runPreflight returns nullable remote + Figma-key without touching disk state", async () => {
    await withTempDir(async () => {
        const pre = await (0, setup_orchestrator_js_1.runPreflight)();
        // In an empty temp dir, neither is detectable — both must resolve to null.
        strict_1.default.equal(pre.gitRemote, null);
        strict_1.default.equal(pre.figmaKey, null);
    });
});
//# sourceMappingURL=setup-orchestrator.test.js.map