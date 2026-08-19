import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { loadConfig } from "./loader.js";
import { renderSkillOverlay } from "./overlay.js";

test("snapshot: overlay for archetype:card with finary config", async () => {
  const config = await loadConfig("test/fixtures/lint/finary.yaml");
  assert.ok(config?.rules);

  const rules = Object.fromEntries(Object.entries(config.rules).filter(([, r]) => r !== "off"));

  const actual = renderSkillOverlay({
    rules: rules as never,
    request: { archetype: "card" },
  });

  const snapshotPath = path.resolve("test/snapshots/overlay-card.xml");
  let expected: string;
  try {
    expected = await readFile(snapshotPath, "utf-8");
  } catch {
    // First run: emit snapshot
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, actual, "utf-8");
    expected = actual;
  }
  // The snapshot is compared line-ending-agnostically: git checks this fixture
  // out with CRLF on Windows while the renderer always emits LF, so a literal
  // comparison fails on that platform for a difference nobody authored.
  assert.equal(normalizeEol(actual).trim(), normalizeEol(expected).trim());
});

function normalizeEol(value: string): string {
  return value.replace(/\r\n/g, "\n");
}
