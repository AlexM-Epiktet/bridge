import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { upsertComponentEntry, encodeVariantAxis } from "./registry-io.js";
import { mergeLocalComponents } from "../cron/orchestrator.js";
import { loadRegistry } from "../compiler/registry.js";

function makeKB(components: unknown[]): { dir: string; file: string } {
  const dir = mkdtempSync(path.join(tmpdir(), "bridge-localcomp-"));
  const reg = path.join(dir, "knowledge-base", "registries");
  mkdirSync(reg, { recursive: true });
  const file = path.join(reg, "components.json");
  writeFileSync(
    file,
    JSON.stringify({ version: 1, generatedAt: "2026-01-01T00:00:00Z", components }, null, 2),
    "utf8"
  );
  return { dir, file };
}

function readComponents(file: string): Array<Record<string, unknown>> {
  return JSON.parse(readFileSync(file, "utf8")).components;
}

const localButton = {
  key: "LOCAL1",
  name: "Button",
  type: "COMPONENT_SET" as const,
  properties: { variant: encodeVariantAxis(["primary", "secondary"]) },
  source: "local" as const,
  registeredAt: "2026-08-19T00:00:00Z",
};

test("encodeVariantAxis writes the shape the compiler's variant validator reads", () => {
  assert.equal(encodeVariantAxis(["primary", "secondary"]), "VARIANT(primary,secondary)");
});

test("upsert inserts a new component and bumps generatedAt", async () => {
  const { dir, file } = makeKB([]);
  try {
    const before = JSON.parse(readFileSync(file, "utf8")).generatedAt;
    const result = await upsertComponentEntry(file, localButton);
    assert.equal(result.action, "inserted");
    assert.equal(result.total, 1);
    assert.notEqual(JSON.parse(readFileSync(file, "utf8")).generatedAt, before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("upsert replaces by key rather than accumulating duplicates", async () => {
  const { dir, file } = makeKB([localButton]);
  try {
    const result = await upsertComponentEntry(file, { ...localButton, name: "Button v2" });
    assert.equal(result.action, "replaced");
    assert.equal(readComponents(file).length, 1);
    assert.equal(readComponents(file)[0]?.name, "Button v2");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("upsert replaces by name when the component was re-created with a new key", async () => {
  const { dir, file } = makeKB([localButton]);
  try {
    // Re-creating a component in Figma yields a new key but the same name;
    // without the name fallback the stale entry would linger and could win
    // resolution.
    const result = await upsertComponentEntry(file, { ...localButton, key: "LOCAL2" });
    assert.equal(result.action, "replaced");
    const components = readComponents(file);
    assert.equal(components.length, 1);
    assert.equal(components[0]?.key, "LOCAL2");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a locally registered component is resolvable by the compiler immediately", async () => {
  const { dir, file } = makeKB([]);
  try {
    await upsertComponentEntry(file, localButton);
    const registry = loadRegistry(dir);
    const entry = registry.components.byName.get("button");
    assert.ok(entry, "the component must be in the registry before any cron run");
    // The encoded property shape is what keeps variant validation working.
    assert.equal(entry?.properties?.variant, "VARIANT(primary,secondary)");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ─── Cron survival ───────────────────────────────────────────────────────────

test("a cron refresh preserves a local component the REST result cannot contain", async () => {
  const { dir, file } = makeKB([localButton]);
  try {
    const fresh = {
      version: 1,
      components: [{ key: "PUB1", name: "Card", type: "COMPONENT_SET" }],
    };
    const merged = await mergeLocalComponents(file, fresh);
    const names = (merged.registry.components as Array<{ name: string }>).map((c) => c.name);
    assert.deepEqual(names.sort(), ["Button", "Card"]);
    assert.equal(merged.preserved, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("publishing promotes a local component instead of duplicating it", async () => {
  const { dir, file } = makeKB([localButton]);
  try {
    // Same key, now returned by Figma: the published entry is authoritative.
    const fresh = {
      version: 1,
      components: [{ key: "LOCAL1", name: "Button", type: "COMPONENT_SET" }],
    };
    const merged = await mergeLocalComponents(file, fresh);
    const components = merged.registry.components as Array<Record<string, unknown>>;
    assert.equal(components.length, 1);
    assert.equal(components[0]?.source, undefined, "the published entry replaces the local one");
    assert.equal(merged.preserved, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a cron refresh grafts hand-maintained code bindings back on", async () => {
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
    const merged = await mergeLocalComponents(file, fresh);
    const entry = (merged.registry.components as Array<Record<string, unknown>>)[0];
    assert.deepEqual(entry?.angular, bound.angular);
    assert.equal(merged.preserved, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("merging against an unreadable previous file still writes the fresh result", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bridge-localcomp-missing-"));
  try {
    const fresh = { version: 1, components: [{ key: "PUB1", name: "Card" }] };
    const merged = await mergeLocalComponents(path.join(dir, "nope.json"), fresh);
    assert.equal((merged.registry.components as unknown[]).length, 1);
    assert.equal(merged.preserved, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
