import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTokenRefs, refFor } from "./token-refs.js";
import type { TokenValueIndex, TokenVariable, ThemeBinding } from "../kb/values.js";

/** Minimal TokenValueIndex builder — only the fields buildTokenRefs reads. */
function index(
  variables: TokenVariable[],
  theme: ThemeBinding[] = [],
  themeCssFile: string | null = null
): TokenValueIndex {
  const themeByName = new Map<string, ThemeBinding>();
  const themeByKey = new Map<string, ThemeBinding>();
  for (const t of theme) {
    if (t.figmaName) themeByName.set(t.figmaName, t);
    if (t.figmaKey) themeByKey.set(t.figmaKey, t);
  }
  return {
    variables,
    variableByName: new Map(variables.map((v) => [v.name, v])),
    variableByKey: new Map(variables.map((v) => [v.key, v])),
    textStyles: [],
    textStyleByName: new Map(),
    textStyleByKey: new Map(),
    themeByName,
    themeByKey,
    themeCssFile,
    modes: ["light"],
    defaultMode: "light",
    warnings: [],
  };
}

test("a token bound in the theme lockfile resolves to the existing custom property", () => {
  const refs = buildTokenRefs(
    index(
      [{ key: "K1", name: "main/color/primary/primary", resolvedType: "COLOR", valuesByMode: {} }],
      [
        {
          cssVar: "--color-primary",
          figmaName: "main/color/primary/primary",
          figmaKey: "K1",
          cssValue: "oklch(52.2% 0.216 268.352)",
        },
      ]
    )
  );
  const ref = refs.byName.get("main/color/primary/primary");
  assert.equal(ref?.reference, "var(--color-primary)");
  assert.equal(ref?.source, "theme-lockfile");
  assert.equal(refs.needsGeneratedStylesheet, false);
  assert.deepEqual(refs.unbound, []);
});

test("a token with KB values resolves to a generated custom property", () => {
  const refs = buildTokenRefs(
    index([
      {
        key: "K2",
        name: "spacing/md",
        resolvedType: "FLOAT",
        valuesByMode: { light: { kind: "number", value: 16 } },
      },
    ])
  );
  const ref = refs.byName.get("spacing/md");
  assert.equal(ref?.reference, "var(--spacing-md)");
  assert.equal(ref?.source, "generated");
  assert.equal(refs.needsGeneratedStylesheet, true);
});

test("the lockfile wins over generated values for the same token", () => {
  const refs = buildTokenRefs(
    index(
      [
        {
          key: "K1",
          name: "main/color/base/100",
          resolvedType: "COLOR",
          valuesByMode: { light: { kind: "color", hex: "#ffffff", alpha: 1 } },
        },
      ],
      [{ cssVar: "--color-base-100", figmaKey: "K1", cssValue: "oklch(98.1% 0.003 228.784)" }]
    )
  );
  assert.equal(refs.byName.get("main/color/base/100")?.source, "theme-lockfile");
  assert.equal(refs.needsGeneratedStylesheet, false);
});

test("a token with neither a value nor a binding is reported unbound, never guessed", () => {
  const refs = buildTokenRefs(
    index([{ key: "K3", name: "space/gap/md", resolvedType: "FLOAT", valuesByMode: {} }])
  );
  assert.equal(refs.byName.has("space/gap/md"), false);
  assert.equal(refs.unbound.length, 1);
  assert.equal(refs.unbound[0]?.token, "space/gap/md");
  assert.match(refs.unbound[0]!.reason, /unknown to the knowledge base/);
});

test("lockfile entries absent from variables.json are still usable", () => {
  const refs = buildTokenRefs(
    index([], [{ cssVar: "--radius-box", figmaName: "radius/box", cssValue: "0.5rem" }])
  );
  assert.equal(refs.byName.get("radius/box")?.reference, "var(--radius-box)");
});

test("refFor matches by key first, then by name, and tolerates the $ prefix", () => {
  const refs = buildTokenRefs(
    index([
      {
        key: "K1",
        name: "color/bg/primary",
        resolvedType: "COLOR",
        valuesByMode: { light: { kind: "color", hex: "#0066ff", alpha: 1 } },
      },
    ])
  );
  assert.equal(refFor(refs, { key: "K1", name: "color/bg/primary" })?.cssVar, "--color-bg-primary");
  assert.equal(refFor(refs, "color/bg/primary")?.cssVar, "--color-bg-primary");
  assert.equal(refFor(refs, "$color/bg/primary")?.cssVar, "--color-bg-primary");
  assert.equal(refFor(refs, { key: "UNKNOWN" }), null);
  assert.equal(refFor(refs, null), null);
});
