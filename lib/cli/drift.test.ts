import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { driftCommand, formatDriftReport, type DriftReport } from "./drift.js";
import { hashRegistryEntries, writeBaseline, baselinePath } from "../kb/baseline.js";

// --- fixtures ---------------------------------------------------------------

/** Exactly the on-disk shape `extractComponentsFromFigma` emits for a
 * standalone component, so an unchanged component hashes identically on both
 * sides of the comparison. */
function localComponent(key: string, name: string, nodeId: string) {
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
function remoteComponent(key: string, name: string, nodeId: string) {
  return {
    key,
    name,
    node_id: nodeId,
    description: "",
    containing_frame: { pageName: "Actions" },
  };
}

interface StubResponse {
  status: number;
  body: unknown;
}

function makeFetch(handler: (url: string) => StubResponse, calls: string[] = []): typeof fetch {
  return (async (input: unknown) => {
    const url = String(input);
    calls.push(url);
    const res = handler(url);
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      json: async () => res.body,
    };
  }) as unknown as typeof fetch;
}

/** Default routes: components drift, empty text styles, variables 403. */
function routesFor(components: unknown[]) {
  return (url: string): StubResponse => {
    if (url.includes("/variables/local")) return { status: 403, body: {} };
    if (url.includes("/component_sets"))
      return { status: 200, body: { meta: { component_sets: [] } } };
    if (url.includes("/components")) return { status: 200, body: { meta: { components } } };
    if (url.includes("/styles")) return { status: 200, body: { meta: { styles: [] } } };
    throw new Error(`unexpected request: ${url}`);
  };
}

const REG_FILES = ["components.json", "variables.json", "text-styles.json"] as const;

function makeKB(label: string, components: Record<string, unknown>[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), `bridge-drift-${label}-`));
  const regDir = path.join(dir, "knowledge-base", "registries");
  mkdirSync(regDir, { recursive: true });
  writeFileSync(
    path.join(regDir, "components.json"),
    JSON.stringify({ version: 1, generatedAt: "2026-01-01T00:00:00Z", components }, null, 2) + "\n"
  );
  writeFileSync(
    path.join(regDir, "variables.json"),
    JSON.stringify({ version: 1, generatedAt: "2026-01-01T00:00:00Z", variables: [] }, null, 2) +
      "\n"
  );
  writeFileSync(
    path.join(regDir, "text-styles.json"),
    JSON.stringify({ version: 1, generatedAt: "2026-01-01T00:00:00Z", styles: [] }, null, 2) + "\n"
  );
  writeFileSync(path.join(dir, "docs.config.yaml"), "dsName: Test DS\nfigmaFileKey: FILEKEY123\n");
  return dir;
}

function configOf(dir: string): string {
  return path.join(dir, "docs.config.yaml");
}

/** Snapshot content + mtime of every registry file, to prove drift is
 * read-only with respect to the KB payload. */
function snapshotRegistries(dir: string): Record<string, { content: string; mtimeMs: number }> {
  const out: Record<string, { content: string; mtimeMs: number }> = {};
  for (const f of REG_FILES) {
    const file = path.join(dir, "knowledge-base", "registries", f);
    out[f] = { content: readFileSync(file, "utf8"), mtimeMs: statSync(file).mtimeMs };
  }
  return out;
}

async function withToken<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.FIGMA_TOKEN;
  process.env.FIGMA_TOKEN = "test-token";
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.FIGMA_TOKEN;
    else process.env.FIGMA_TOKEN = prev;
  }
}

function entryFor(report: DriftReport, registry: string, source: "upstream" | "local") {
  const found = report.registries.find((r) => r.registry === registry && r.source === source);
  assert.ok(found, `expected a ${source} entry for ${registry}`);
  return found;
}

// --- tests ------------------------------------------------------------------

test("driftCommand reports added and removed components upstream", async () => {
  const dir = makeKB("upstream", [
    localComponent("A", "Alpha", "1:1"),
    localComponent("B", "Beta", "1:2"),
  ]);
  try {
    // Baseline matches the local file exactly: only upstream should drift.
    await writeBaseline(dir, {
      version: 1,
      baselines: {
        "components.json": {
          ...hashRegistryEntries([
            localComponent("A", "Alpha", "1:1"),
            localComponent("B", "Beta", "1:2"),
          ]),
          entryCount: 2,
          capturedAt: "2026-01-01T00:00:00.000Z",
        },
        "variables.json": {
          ...hashRegistryEntries([]),
          entryCount: 0,
          capturedAt: "2026-01-01T00:00:00.000Z",
        },
        "text-styles.json": {
          ...hashRegistryEntries([]),
          entryCount: 0,
          capturedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    });

    const report = await withToken(() =>
      driftCommand({
        kbPath: dir,
        configPath: configOf(dir),
        fetchImpl: makeFetch(
          routesFor([remoteComponent("A", "Alpha", "1:1"), remoteComponent("C", "Gamma", "1:3")])
        ),
      })
    );

    const upstream = entryFor(report, "components.json", "upstream");
    assert.equal(upstream.diff.status, "changed");
    assert.deepEqual(upstream.diff.added, ["C"]);
    assert.deepEqual(upstream.diff.removed, ["B"]);
    assert.deepEqual(upstream.diff.modified, []);

    // The on-disk registry itself did not move.
    assert.equal(entryFor(report, "components.json", "local").diff.status, "unchanged");
    assert.equal(entryFor(report, "text-styles.json", "upstream").diff.status, "unchanged");

    assert.equal(report.exitCode, 1);
    assert.ok(
      report.recommendations.some((r) => r.includes("components.json") && r.includes("cron")),
      `expected a cron recommendation, got ${JSON.stringify(report.recommendations)}`
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("driftCommand detects a locally edited registry", async () => {
  const dir = makeKB("local", [localComponent("A", "Alpha", "1:1")]);
  try {
    // Baseline knows about A and B; the file on disk only has A.
    await writeBaseline(dir, {
      version: 1,
      baselines: {
        "components.json": {
          ...hashRegistryEntries([
            localComponent("A", "Alpha", "1:1"),
            localComponent("B", "Beta", "1:2"),
          ]),
          entryCount: 2,
          capturedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    });

    const report = await withToken(() =>
      driftCommand({
        kbPath: dir,
        configPath: configOf(dir),
        fetchImpl: makeFetch(routesFor([remoteComponent("A", "Alpha", "1:1")])),
      })
    );

    const local = entryFor(report, "components.json", "local");
    assert.equal(local.diff.status, "changed");
    assert.deepEqual(local.diff.removed, ["B"]);
    assert.equal(report.exitCode, 1);
    assert.ok(report.recommendations.some((r) => r.includes("changed locally")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("driftCommand tolerates VariablesEndpointUnavailableError and still reports", async () => {
  const dir = makeKB("vars", [localComponent("A", "Alpha", "1:1")]);
  try {
    const report = await withToken(() =>
      driftCommand({
        kbPath: dir,
        configPath: configOf(dir),
        fetchImpl: makeFetch(routesFor([remoteComponent("A", "Alpha", "1:1")])),
      })
    );

    const vars = entryFor(report, "variables.json", "upstream");
    // Enterprise-only endpoint: reported as not probed, never as drift.
    assert.notEqual(vars.diff.status, "changed");
    assert.match(String(vars.note), /not probed/i);
    assert.match(String(vars.note), /403|Enterprise/i);
    assert.ok(report.recommendations.some((r) => r.includes("variables.json")));
    // Other registries were still probed.
    assert.ok(report.registries.some((r) => r.registry === "components.json"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("driftCommand handles a first run with no baseline", async () => {
  const dir = makeKB("firstrun", [localComponent("A", "Alpha", "1:1")]);
  try {
    const report = await withToken(() =>
      driftCommand({
        kbPath: dir,
        configPath: configOf(dir),
        fetchImpl: makeFetch(routesFor([remoteComponent("A", "Alpha", "1:1")])),
      })
    );

    assert.equal(entryFor(report, "components.json", "local").diff.status, "new");
    assert.equal(entryFor(report, "components.json", "upstream").diff.status, "new");
    assert.equal(report.exitCode, 0);
    assert.ok(report.recommendations.some((r) => r.includes("No baseline recorded yet")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("driftCommand never writes to knowledge-base/registries", async () => {
  const dir = makeKB("readonly", [localComponent("A", "Alpha", "1:1")]);
  try {
    const before = snapshotRegistries(dir);
    await withToken(() =>
      driftCommand({
        kbPath: dir,
        configPath: configOf(dir),
        updateBaseline: true,
        fetchImpl: makeFetch(
          routesFor([remoteComponent("A", "Alpha", "1:1"), remoteComponent("C", "Gamma", "1:3")])
        ),
      })
    );
    assert.deepEqual(snapshotRegistries(dir), before);
    // The only permitted write is the baseline itself.
    assert.ok(readFileSync(baselinePath(dir), "utf8").includes("components.json"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("updateBaseline records the on-disk state so the next run is clean locally", async () => {
  const dir = makeKB("update", [localComponent("A", "Alpha", "1:1")]);
  try {
    const fetchImpl = makeFetch(routesFor([remoteComponent("A", "Alpha", "1:1")]));
    await withToken(() =>
      driftCommand({ kbPath: dir, configPath: configOf(dir), updateBaseline: true, fetchImpl })
    );
    const second = await withToken(() =>
      driftCommand({ kbPath: dir, configPath: configOf(dir), fetchImpl })
    );
    assert.equal(entryFor(second, "components.json", "local").diff.status, "unchanged");
    assert.equal(entryFor(second, "components.json", "upstream").diff.status, "unchanged");
    assert.equal(second.exitCode, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("driftCommand skips the upstream probe without a token instead of failing", async () => {
  const dir = makeKB("notoken", [localComponent("A", "Alpha", "1:1")]);
  const prev = process.env.FIGMA_TOKEN;
  delete process.env.FIGMA_TOKEN;
  try {
    const report = await driftCommand({ kbPath: dir, configPath: configOf(dir) });
    assert.match(String(entryFor(report, "components.json", "upstream").note), /FIGMA_TOKEN/);
    assert.equal(report.exitCode, 0);
  } finally {
    if (prev !== undefined) process.env.FIGMA_TOKEN = prev;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("formatDriftReport renders a readable plain-text report", async () => {
  const dir = makeKB("format", [localComponent("A", "Alpha", "1:1")]);
  try {
    const report = await withToken(() =>
      driftCommand({
        kbPath: dir,
        configPath: configOf(dir),
        fetchImpl: makeFetch(routesFor([remoteComponent("A", "Alpha", "1:1")])),
      })
    );
    const text = formatDriftReport(report);
    assert.ok(text.includes("Bridge KB drift report"));
    assert.ok(text.includes("components.json"));
    assert.ok(text.includes("Recommendations"));
    assert.ok(text.includes("read-only"));
    // Plain text only — no ANSI colour escapes.
    assert.doesNotMatch(text, /\u001b\[/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
