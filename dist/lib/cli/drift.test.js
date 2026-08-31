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
const drift_js_1 = require("./drift.js");
const baseline_js_1 = require("../kb/baseline.js");
// --- fixtures ---------------------------------------------------------------
/** Exactly the on-disk shape `extractComponentsFromFigma` emits for a
 * standalone component, so an unchanged component hashes identically on both
 * sides of the comparison. */
function localComponent(key, name, nodeId) {
    return {
        name,
        key,
        id: nodeId,
        type: "COMPONENT",
        page: "Actions",
        category: "actions",
        properties: {},
        description: "",
    };
}
/** The REST payload shape `/v1/files/{key}/components` returns. */
function remoteComponent(key, name, nodeId) {
    return {
        key,
        name,
        node_id: nodeId,
        description: "",
        containing_frame: { pageName: "Actions" },
    };
}
function makeFetch(handler, calls = []) {
    return (async (input) => {
        const url = String(input);
        calls.push(url);
        const res = handler(url);
        return {
            ok: res.status >= 200 && res.status < 300,
            status: res.status,
            json: async () => res.body,
        };
    });
}
/** Default routes: components drift, empty text styles, variables 403. */
function routesFor(components) {
    return (url) => {
        if (url.includes("/variables/local"))
            return { status: 403, body: {} };
        if (url.includes("/component_sets"))
            return { status: 200, body: { meta: { component_sets: [] } } };
        if (url.includes("/components"))
            return { status: 200, body: { meta: { components } } };
        if (url.includes("/styles"))
            return { status: 200, body: { meta: { styles: [] } } };
        throw new Error(`unexpected request: ${url}`);
    };
}
const REG_FILES = ["components.json", "variables.json", "text-styles.json"];
function makeKB(label, components) {
    const dir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), `bridge-drift-${label}-`));
    const regDir = node_path_1.default.join(dir, "knowledge-base", "registries");
    (0, node_fs_1.mkdirSync)(regDir, { recursive: true });
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "components.json"), JSON.stringify({ version: 1, generatedAt: "2026-01-01T00:00:00Z", components }, null, 2) + "\n");
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "variables.json"), JSON.stringify({ version: 1, generatedAt: "2026-01-01T00:00:00Z", variables: [] }, null, 2) +
        "\n");
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "text-styles.json"), JSON.stringify({ version: 1, generatedAt: "2026-01-01T00:00:00Z", styles: [] }, null, 2) + "\n");
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(dir, "docs.config.yaml"), "dsName: Test DS\nfigmaFileKey: FILEKEY123\n");
    return dir;
}
function configOf(dir) {
    return node_path_1.default.join(dir, "docs.config.yaml");
}
/** Snapshot content + mtime of every registry file, to prove drift is
 * read-only with respect to the KB payload. */
function snapshotRegistries(dir) {
    const out = {};
    for (const f of REG_FILES) {
        const file = node_path_1.default.join(dir, "knowledge-base", "registries", f);
        out[f] = { content: (0, node_fs_1.readFileSync)(file, "utf8"), mtimeMs: (0, node_fs_1.statSync)(file).mtimeMs };
    }
    return out;
}
async function withToken(fn) {
    const prev = process.env.FIGMA_TOKEN;
    process.env.FIGMA_TOKEN = "test-token";
    try {
        return await fn();
    }
    finally {
        if (prev === undefined)
            delete process.env.FIGMA_TOKEN;
        else
            process.env.FIGMA_TOKEN = prev;
    }
}
function entryFor(report, registry, source) {
    const found = report.registries.find((r) => r.registry === registry && r.source === source);
    strict_1.default.ok(found, `expected a ${source} entry for ${registry}`);
    return found;
}
// --- tests ------------------------------------------------------------------
(0, node_test_1.test)("driftCommand reports added and removed components upstream", async () => {
    const dir = makeKB("upstream", [
        localComponent("A", "Alpha", "1:1"),
        localComponent("B", "Beta", "1:2"),
    ]);
    try {
        // Baseline matches the local file exactly: only upstream should drift.
        await (0, baseline_js_1.writeBaseline)(dir, {
            version: 1,
            baselines: {
                "components.json": {
                    ...(0, baseline_js_1.hashRegistryEntries)([
                        localComponent("A", "Alpha", "1:1"),
                        localComponent("B", "Beta", "1:2"),
                    ]),
                    entryCount: 2,
                    capturedAt: "2026-01-01T00:00:00.000Z",
                },
                "variables.json": {
                    ...(0, baseline_js_1.hashRegistryEntries)([]),
                    entryCount: 0,
                    capturedAt: "2026-01-01T00:00:00.000Z",
                },
                "text-styles.json": {
                    ...(0, baseline_js_1.hashRegistryEntries)([]),
                    entryCount: 0,
                    capturedAt: "2026-01-01T00:00:00.000Z",
                },
            },
        });
        const report = await withToken(() => (0, drift_js_1.driftCommand)({
            kbPath: dir,
            configPath: configOf(dir),
            fetchImpl: makeFetch(routesFor([remoteComponent("A", "Alpha", "1:1"), remoteComponent("C", "Gamma", "1:3")])),
        }));
        const upstream = entryFor(report, "components.json", "upstream");
        strict_1.default.equal(upstream.diff.status, "changed");
        strict_1.default.deepEqual(upstream.diff.added, ["C"]);
        strict_1.default.deepEqual(upstream.diff.removed, ["B"]);
        strict_1.default.deepEqual(upstream.diff.modified, []);
        // The on-disk registry itself did not move.
        strict_1.default.equal(entryFor(report, "components.json", "local").diff.status, "unchanged");
        strict_1.default.equal(entryFor(report, "text-styles.json", "upstream").diff.status, "unchanged");
        strict_1.default.equal(report.exitCode, 1);
        strict_1.default.ok(report.recommendations.some((r) => r.includes("components.json") && r.includes("cron")), `expected a cron recommendation, got ${JSON.stringify(report.recommendations)}`);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("driftCommand detects a locally edited registry", async () => {
    const dir = makeKB("local", [localComponent("A", "Alpha", "1:1")]);
    try {
        // Baseline knows about A and B; the file on disk only has A.
        await (0, baseline_js_1.writeBaseline)(dir, {
            version: 1,
            baselines: {
                "components.json": {
                    ...(0, baseline_js_1.hashRegistryEntries)([
                        localComponent("A", "Alpha", "1:1"),
                        localComponent("B", "Beta", "1:2"),
                    ]),
                    entryCount: 2,
                    capturedAt: "2026-01-01T00:00:00.000Z",
                },
            },
        });
        const report = await withToken(() => (0, drift_js_1.driftCommand)({
            kbPath: dir,
            configPath: configOf(dir),
            fetchImpl: makeFetch(routesFor([remoteComponent("A", "Alpha", "1:1")])),
        }));
        const local = entryFor(report, "components.json", "local");
        strict_1.default.equal(local.diff.status, "changed");
        strict_1.default.deepEqual(local.diff.removed, ["B"]);
        strict_1.default.equal(report.exitCode, 1);
        strict_1.default.ok(report.recommendations.some((r) => r.includes("changed locally")));
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("driftCommand tolerates VariablesEndpointUnavailableError and still reports", async () => {
    const dir = makeKB("vars", [localComponent("A", "Alpha", "1:1")]);
    try {
        const report = await withToken(() => (0, drift_js_1.driftCommand)({
            kbPath: dir,
            configPath: configOf(dir),
            fetchImpl: makeFetch(routesFor([remoteComponent("A", "Alpha", "1:1")])),
        }));
        const vars = entryFor(report, "variables.json", "upstream");
        // Enterprise-only endpoint: reported as not probed, never as drift.
        strict_1.default.notEqual(vars.diff.status, "changed");
        strict_1.default.match(String(vars.note), /not probed/i);
        strict_1.default.match(String(vars.note), /403|Enterprise/i);
        strict_1.default.ok(report.recommendations.some((r) => r.includes("variables.json")));
        // Other registries were still probed.
        strict_1.default.ok(report.registries.some((r) => r.registry === "components.json"));
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("driftCommand handles a first run with no baseline", async () => {
    const dir = makeKB("firstrun", [localComponent("A", "Alpha", "1:1")]);
    try {
        const report = await withToken(() => (0, drift_js_1.driftCommand)({
            kbPath: dir,
            configPath: configOf(dir),
            fetchImpl: makeFetch(routesFor([remoteComponent("A", "Alpha", "1:1")])),
        }));
        strict_1.default.equal(entryFor(report, "components.json", "local").diff.status, "new");
        strict_1.default.equal(entryFor(report, "components.json", "upstream").diff.status, "new");
        strict_1.default.equal(report.exitCode, 0);
        strict_1.default.ok(report.recommendations.some((r) => r.includes("No baseline recorded yet")));
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("driftCommand never writes to knowledge-base/registries", async () => {
    const dir = makeKB("readonly", [localComponent("A", "Alpha", "1:1")]);
    try {
        const before = snapshotRegistries(dir);
        await withToken(() => (0, drift_js_1.driftCommand)({
            kbPath: dir,
            configPath: configOf(dir),
            updateBaseline: true,
            fetchImpl: makeFetch(routesFor([remoteComponent("A", "Alpha", "1:1"), remoteComponent("C", "Gamma", "1:3")])),
        }));
        strict_1.default.deepEqual(snapshotRegistries(dir), before);
        // The only permitted write is the baseline itself.
        strict_1.default.ok((0, node_fs_1.readFileSync)((0, baseline_js_1.baselinePath)(dir), "utf8").includes("components.json"));
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("updateBaseline records the on-disk state so the next run is clean locally", async () => {
    const dir = makeKB("update", [localComponent("A", "Alpha", "1:1")]);
    try {
        const fetchImpl = makeFetch(routesFor([remoteComponent("A", "Alpha", "1:1")]));
        await withToken(() => (0, drift_js_1.driftCommand)({ kbPath: dir, configPath: configOf(dir), updateBaseline: true, fetchImpl }));
        const second = await withToken(() => (0, drift_js_1.driftCommand)({ kbPath: dir, configPath: configOf(dir), fetchImpl }));
        strict_1.default.equal(entryFor(second, "components.json", "local").diff.status, "unchanged");
        strict_1.default.equal(entryFor(second, "components.json", "upstream").diff.status, "unchanged");
        strict_1.default.equal(second.exitCode, 0);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("driftCommand skips the upstream probe without a token instead of failing", async () => {
    const dir = makeKB("notoken", [localComponent("A", "Alpha", "1:1")]);
    const prev = process.env.FIGMA_TOKEN;
    delete process.env.FIGMA_TOKEN;
    try {
        const report = await (0, drift_js_1.driftCommand)({ kbPath: dir, configPath: configOf(dir) });
        strict_1.default.match(String(entryFor(report, "components.json", "upstream").note), /FIGMA_TOKEN/);
        strict_1.default.equal(report.exitCode, 0);
    }
    finally {
        if (prev !== undefined)
            process.env.FIGMA_TOKEN = prev;
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("formatDriftReport renders a readable plain-text report", async () => {
    const dir = makeKB("format", [localComponent("A", "Alpha", "1:1")]);
    try {
        const report = await withToken(() => (0, drift_js_1.driftCommand)({
            kbPath: dir,
            configPath: configOf(dir),
            fetchImpl: makeFetch(routesFor([remoteComponent("A", "Alpha", "1:1")])),
        }));
        const text = (0, drift_js_1.formatDriftReport)(report);
        strict_1.default.ok(text.includes("Bridge KB drift report"));
        strict_1.default.ok(text.includes("components.json"));
        strict_1.default.ok(text.includes("Recommendations"));
        strict_1.default.ok(text.includes("read-only"));
        // Plain text only — no ANSI colour escapes.
        strict_1.default.doesNotMatch(text, /\u001b\[/);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
//# sourceMappingURL=drift.test.js.map