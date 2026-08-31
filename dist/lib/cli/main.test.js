"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const BIN = node_path_1.default.resolve("bin/bridge.js");
function run(args, env = {}) {
    return (0, node_child_process_1.spawnSync)(process.execPath, [BIN, ...args], {
        encoding: "utf8",
        env: { ...process.env, ...env },
    });
}
(0, node_test_1.test)("help prints the command list and exits 0", () => {
    const r = run(["help"]);
    strict_1.default.equal(r.status, 0);
    strict_1.default.match(r.stdout, /bridge-ds v\d+\.\d+\.\d+/);
    strict_1.default.match(r.stdout, /setup\s+Headless scaffold/);
    strict_1.default.match(r.stdout, /cron/);
});
(0, node_test_1.test)("no args shows help (exit 0)", () => {
    const r = run([]);
    strict_1.default.equal(r.status, 0);
    strict_1.default.match(r.stdout, /bridge-ds v/);
});
(0, node_test_1.test)("version prints only the semantic version", () => {
    const r = run(["version"]);
    strict_1.default.equal(r.status, 0);
    strict_1.default.match(r.stdout.trim(), /^bridge-ds v\d+\.\d+\.\d+$/);
});
(0, node_test_1.test)("unknown command exits non-zero with a helpful message", () => {
    const r = run(["nonexistent-cmd"]);
    strict_1.default.notEqual(r.status, 0);
    strict_1.default.match(r.stderr, /Unknown command: nonexistent-cmd/);
});
(0, node_test_1.test)("removed v5 commands (init, update, docs, init-docs) now error as Unknown command", () => {
    for (const cmd of ["init", "update", "init-docs", "docs"]) {
        const r = run([cmd]);
        strict_1.default.notEqual(r.status, 0, `${cmd} should exit non-zero`);
        strict_1.default.match(r.stderr, /Unknown command/, `${cmd} should show Unknown command`);
    }
});
(0, node_test_1.test)("`extract` without --headless errors (safety net)", () => {
    const r = run(["extract"]);
    strict_1.default.notEqual(r.status, 0);
    strict_1.default.match(r.stderr, /Only headless extraction/);
});
(0, node_test_1.test)("bridge-ds migrate exits 0 on a legacy KB and makes it current", () => {
    const FIXTURE = node_path_1.default.resolve("test/fixtures/kb/legacy-grouped");
    const dir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-cli-e2e-"));
    (0, node_fs_1.cpSync)(FIXTURE, dir, { recursive: true });
    try {
        const r = run(["migrate", "--kb-path", dir]);
        strict_1.default.equal(r.status, 0, `stderr: ${r.stderr}`);
        const result = JSON.parse(r.stdout);
        strict_1.default.equal(result.migrated, true);
        strict_1.default.equal(result.from, "legacy-grouped");
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
//# sourceMappingURL=main.test.js.map