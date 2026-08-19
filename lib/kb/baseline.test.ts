import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  hashRegistryEntries,
  readBaseline,
  writeBaseline,
  diffRegistry,
  baselinePath,
  type KBBaseline,
  type RegistryBaseline,
} from "./baseline.js";

function tempKB(label: string): string {
  return mkdtempSync(path.join(tmpdir(), `bridge-baseline-${label}-`));
}

function baselineFor(entries: readonly Record<string, unknown>[]): RegistryBaseline {
  const { hash, entryHashes } = hashRegistryEntries(entries);
  return {
    hash,
    entryHashes,
    entryCount: Object.keys(entryHashes).length,
    capturedAt: "2026-01-01T00:00:00.000Z",
  };
}

test("hashRegistryEntries is stable across key reordering", () => {
  const a = hashRegistryEntries([{ key: "btn", name: "Button", category: "actions" }]);
  const b = hashRegistryEntries([{ category: "actions", name: "Button", key: "btn" }]);
  assert.equal(a.hash, b.hash);
  assert.deepEqual(a.entryHashes, b.entryHashes);
});

test("hashRegistryEntries is insensitive to entry order", () => {
  const a = hashRegistryEntries([{ key: "a" }, { key: "b" }]);
  const b = hashRegistryEntries([{ key: "b" }, { key: "a" }]);
  assert.equal(a.hash, b.hash);
});

test("hashing ignores the volatile generatedAt envelope", () => {
  // Registries carry a `generatedAt` that changes on every extraction. Only
  // the entries are hashed, so two extractions of identical content match.
  const first = { version: 1, generatedAt: "2026-01-01T00:00:00Z", components: [{ key: "btn" }] };
  const second = { version: 1, generatedAt: "2026-08-19T12:34:56Z", components: [{ key: "btn" }] };
  assert.equal(
    hashRegistryEntries(first.components).hash,
    hashRegistryEntries(second.components).hash
  );
});

test("entries without the id field still participate under a synthetic id", () => {
  const { entryHashes } = hashRegistryEntries([{ name: "no key here" }]);
  const ids = Object.keys(entryHashes);
  assert.equal(ids.length, 1);
  assert.match(ids[0], /^#anon:[0-9a-f]{16}$/);
});

test("hashRegistryEntries honours a custom idField", () => {
  const { entryHashes } = hashRegistryEntries([{ name: "Heading/XL", size: 32 }], "name");
  assert.deepEqual(Object.keys(entryHashes), ["Heading/XL"]);
});

test("duplicate ids are disambiguated instead of collapsing", () => {
  const { entryHashes } = hashRegistryEntries([
    { key: "dup", v: 1 },
    { key: "dup", v: 2 },
  ]);
  assert.deepEqual(Object.keys(entryHashes).sort(), ["dup", "dup#2"]);
});

test("diffRegistry reports unchanged when nothing moved", () => {
  const prev = baselineFor([{ key: "a" }, { key: "b" }]);
  const diff = diffRegistry(prev, hashRegistryEntries([{ key: "b" }, { key: "a" }]));
  assert.equal(diff.status, "unchanged");
  assert.deepEqual(diff, { status: "unchanged", added: [], removed: [], modified: [] });
});

test("diffRegistry classifies added, removed and modified entries", () => {
  const prev = baselineFor([
    { key: "a", v: 1 },
    { key: "b", v: 1 },
  ]);
  const diff = diffRegistry(
    prev,
    hashRegistryEntries([
      { key: "a", v: 2 },
      { key: "c", v: 1 },
    ])
  );
  assert.equal(diff.status, "changed");
  assert.deepEqual(diff.added, ["c"]);
  assert.deepEqual(diff.removed, ["b"]);
  assert.deepEqual(diff.modified, ["a"]);
});

test("diffRegistry reports status new when there is no baseline", () => {
  const diff = diffRegistry(undefined, hashRegistryEntries([{ key: "a" }]));
  assert.deepEqual(diff, { status: "new", added: [], removed: [], modified: [] });
});

test("readBaseline returns null when the KB has never been baselined", async () => {
  const dir = tempKB("absent");
  try {
    assert.equal(await readBaseline(dir), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeBaseline then readBaseline round-trips", async () => {
  const dir = tempKB("roundtrip");
  try {
    const baseline: KBBaseline = {
      version: 1,
      baselines: { "components.json": baselineFor([{ key: "a" }]) },
    };
    await writeBaseline(dir, baseline);
    assert.ok(existsSync(baselinePath(dir)));
    const read = await readBaseline(dir);
    assert.deepEqual(read, baseline);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readBaseline treats a corrupt baseline as absent rather than throwing", async () => {
  const dir = tempKB("corrupt");
  try {
    const fs = await import("node:fs");
    fs.mkdirSync(path.dirname(baselinePath(dir)), { recursive: true });
    fs.writeFileSync(baselinePath(dir), "{ not json");
    assert.equal(await readBaseline(dir), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
