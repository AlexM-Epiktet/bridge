import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadTokenValues, rgbaToHex } from "./values.js";

/** Write a throwaway KB with the given registry files and return its root. */
function makeKB(files: Record<string, unknown>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "bridge-values-"));
  const reg = path.join(dir, "knowledge-base", "registries");
  mkdirSync(reg, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(reg, name), JSON.stringify(content, null, 2), "utf8");
  }
  return dir;
}

test("rgbaToHex converts Figma floats to hex and keeps alpha separate", () => {
  assert.deepEqual(rgbaToHex({ r: 0, g: 0.4, b: 1, a: 1 }), { hex: "#0066ff", alpha: 1 });
  assert.deepEqual(rgbaToHex({ r: 1, g: 1, b: 1 }), { hex: "#ffffff", alpha: 1 });
  assert.deepEqual(rgbaToHex({ r: 0, g: 0, b: 0, a: 0.5 }), { hex: "#000000", alpha: 0.5 });
});

test("rgbaToHex clamps out-of-range channels", () => {
  assert.equal(rgbaToHex({ r: -1, g: 2, b: 0.5 }).hex, "#00ff80");
});

test("loadTokenValues resolves colors and numbers per mode", () => {
  const dir = makeKB({
    "variables.json": {
      version: 1,
      variables: [
        {
          key: "K1",
          name: "color/bg/primary",
          resolvedType: "COLOR",
          valuesByMode: {
            light: { r: 0, g: 0.4, b: 1, a: 1 },
            dark: { r: 0.2, g: 0.52, b: 1, a: 1 },
          },
        },
        {
          key: "K2",
          name: "spacing/md",
          resolvedType: "FLOAT",
          scopes: ["GAP"],
          valuesByMode: { light: 16 },
        },
      ],
    },
  });
  try {
    const idx = loadTokenValues(dir);
    assert.equal(idx.defaultMode, "light");
    assert.deepEqual(idx.modes, ["light", "dark"]);

    const color = idx.variableByName.get("color/bg/primary");
    assert.deepEqual(color?.valuesByMode.light, { kind: "color", hex: "#0066ff", alpha: 1 });
    assert.deepEqual(color?.valuesByMode.dark, { kind: "color", hex: "#3385ff", alpha: 1 });

    const spacing = idx.variableByName.get("spacing/md");
    assert.deepEqual(spacing?.valuesByMode.light, { kind: "number", value: 16 });
    assert.deepEqual(spacing?.scopes, ["GAP"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadTokenValues follows a VARIABLE_ALIAS chain by id", () => {
  const dir = makeKB({
    "variables.json": {
      variables: [
        {
          key: "KBASE",
          id: "VariableID:1:1",
          name: "palette/blue/500",
          resolvedType: "COLOR",
          valuesByMode: { light: { r: 0, g: 0.4, b: 1, a: 1 } },
        },
        {
          key: "KALIAS",
          id: "VariableID:1:2",
          name: "color/bg/primary",
          resolvedType: "COLOR",
          valuesByMode: { light: { type: "VARIABLE_ALIAS", id: "VariableID:1:1" } },
        },
      ],
    },
  });
  try {
    const idx = loadTokenValues(dir);
    assert.deepEqual(idx.variableByName.get("color/bg/primary")?.valuesByMode.light, {
      kind: "color",
      hex: "#0066ff",
      alpha: 1,
    });
    assert.equal(idx.warnings.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadTokenValues reports an alias cycle instead of looping", () => {
  const dir = makeKB({
    "variables.json": {
      variables: [
        {
          key: "KA",
          id: "A",
          name: "a",
          resolvedType: "COLOR",
          valuesByMode: { light: { type: "VARIABLE_ALIAS", id: "B" } },
        },
        {
          key: "KB",
          id: "B",
          name: "b",
          resolvedType: "COLOR",
          valuesByMode: { light: { type: "VARIABLE_ALIAS", id: "A" } },
        },
      ],
    },
  });
  try {
    const idx = loadTokenValues(dir);
    assert.equal(Object.keys(idx.variableByName.get("a")!.valuesByMode).length, 0);
    assert.ok(idx.warnings.some((w) => w.includes("alias cycle")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadTokenValues reports an unresolvable alias target without guessing", () => {
  const dir = makeKB({
    "variables.json": {
      variables: [
        {
          key: "KA",
          name: "color/bg/primary",
          resolvedType: "COLOR",
          valuesByMode: { light: { type: "VARIABLE_ALIAS", id: "VariableID:9:9" } },
        },
      ],
    },
  });
  try {
    const idx = loadTokenValues(dir);
    assert.deepEqual(idx.variableByName.get("color/bg/primary")?.valuesByMode, {});
    assert.ok(idx.warnings.some((w) => w.includes("not found in the registry")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadTokenValues flattens the collections-keyed variable shape", () => {
  const dir = makeKB({
    "variables.json": {
      collections: {
        Core: {
          variables: [
            { key: "K1", name: "spacing/sm", resolvedType: "FLOAT", valuesByMode: { light: 8 } },
          ],
        },
      },
    },
  });
  try {
    const idx = loadTokenValues(dir);
    assert.equal(idx.variables.length, 1);
    assert.deepEqual(idx.variableByName.get("spacing/sm")?.valuesByMode.light, {
      kind: "number",
      value: 8,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadTokenValues indexes theme-lockfile bindings by name and key", () => {
  const dir = makeKB({
    "variables.json": {
      variables: [{ key: "K1", name: "main/color/primary/primary", resolvedType: "COLOR" }],
    },
    "theme-values.json": {
      cssFile: "src/theme/amli-theme.css",
      tokens: [
        {
          cssVar: "--color-primary",
          figmaName: "main/color/primary/primary",
          figmaKey: "K1",
          type: "color",
          cssValue: "oklch(52.2% 0.216 268.352)",
        },
      ],
    },
  });
  try {
    const idx = loadTokenValues(dir);
    assert.equal(idx.themeCssFile, "src/theme/amli-theme.css");
    assert.equal(idx.themeByName.get("main/color/primary/primary")?.cssVar, "--color-primary");
    assert.equal(idx.themeByKey.get("K1")?.cssVar, "--color-primary");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadTokenValues flags the placeholder typography fingerprint", () => {
  const dir = makeKB({
    "text-styles.json": {
      styles: [
        {
          key: "S1",
          name: "sans/sm",
          fontFamily: "Inter",
          fontStyle: "Regular",
          fontSize: 14,
          lineHeight: 20,
        },
        {
          key: "S2",
          name: "sans/xl",
          fontFamily: "Inter",
          fontStyle: "Regular",
          fontSize: 14,
          lineHeight: 20,
        },
      ],
    },
  });
  try {
    const idx = loadTokenValues(dir);
    assert.equal(
      idx.textStyles.every((s) => !s.metricsResolved),
      true
    );
    assert.ok(idx.warnings.some((w) => w.includes("pre-7.4 REST extractor")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadTokenValues keeps genuinely varied typography metrics", () => {
  const dir = makeKB({
    "text-styles.json": {
      styles: [
        {
          key: "S1",
          name: "sans/sm",
          fontFamily: "Inter",
          fontStyle: "Regular",
          fontSize: 14,
          lineHeight: 20,
        },
        {
          key: "S2",
          name: "sans/xl",
          fontFamily: "Inter",
          fontStyle: "Bold",
          fontSize: 24,
          lineHeight: 32,
        },
      ],
    },
  });
  try {
    const idx = loadTokenValues(dir);
    assert.equal(
      idx.textStyles.every((s) => s.metricsResolved),
      true
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadTokenValues on a missing KB yields an empty index, not a throw", () => {
  const idx = loadTokenValues(path.join(tmpdir(), "bridge-does-not-exist-" + Date.now()));
  assert.deepEqual(idx.variables, []);
  assert.deepEqual(idx.textStyles, []);
  assert.equal(idx.themeCssFile, null);
});
