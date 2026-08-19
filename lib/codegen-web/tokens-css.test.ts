import { test } from "node:test";
import assert from "node:assert/strict";
import { emitTokensCss, cssVarName } from "./tokens-css.js";
import type { TokenValueIndex, TokenVariable, TokenTextStyle } from "../kb/values.js";

function index(
  variables: TokenVariable[],
  textStyles: TokenTextStyle[] = [],
  modes: string[] = ["light"],
  defaultMode = "light"
): TokenValueIndex {
  return {
    variables,
    variableByName: new Map(variables.map((v) => [v.name, v])),
    variableByKey: new Map(variables.map((v) => [v.key, v])),
    textStyles,
    textStyleByName: new Map(textStyles.map((s) => [s.name, s])),
    textStyleByKey: new Map(textStyles.map((s) => [s.key, s])),
    themeByName: new Map(),
    themeByKey: new Map(),
    themeCssFile: null,
    modes,
    defaultMode,
    warnings: [],
  };
}

test("cssVarName slugifies a token path", () => {
  assert.equal(cssVarName("color/bg/primary"), "--color-bg-primary");
  assert.equal(cssVarName("$spacing/md"), "--spacing-md");
  assert.equal(cssVarName("color/bg/primary", "ds"), "--ds-color-bg-primary");
});

test("the default mode lands on :root and other modes get their own selector", () => {
  const { css } = emitTokensCss(
    index(
      [
        {
          key: "K1",
          name: "color/bg/primary",
          resolvedType: "COLOR",
          valuesByMode: {
            light: { kind: "color", hex: "#0066ff", alpha: 1 },
            dark: { kind: "color", hex: "#3385ff", alpha: 1 },
          },
        },
      ],
      [],
      ["light", "dark"]
    )
  );
  assert.match(css, /:root \{\n {2}--color-bg-primary: #0066ff;\n\}/);
  assert.match(css, /\[data-theme="dark"\] \{\n {2}--color-bg-primary: #3385ff;/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
});

test("a FLOAT with a dimensional Figma scope gets px", () => {
  const { css, warnings } = emitTokensCss(
    index([
      {
        key: "K1",
        name: "sizing/gutter",
        resolvedType: "FLOAT",
        scopes: ["GAP"],
        valuesByMode: { light: { kind: "number", value: 16 } },
      },
    ])
  );
  assert.match(css, /--sizing-gutter: 16px;/);
  assert.deepEqual(warnings, []);
});

test("an OPACITY-scoped FLOAT stays unitless", () => {
  const { css } = emitTokensCss(
    index([
      {
        key: "K1",
        name: "effect/disabled",
        resolvedType: "FLOAT",
        scopes: ["OPACITY"],
        valuesByMode: { light: { kind: "number", value: 0.5 } },
      },
    ])
  );
  assert.match(css, /--effect-disabled: 0\.5;/);
});

test("an unscoped FLOAT falls back to the name convention and warns when ambiguous", () => {
  const scoped = emitTokensCss(
    index([
      {
        key: "K1",
        name: "spacing/md",
        resolvedType: "FLOAT",
        valuesByMode: { light: { kind: "number", value: 16 } },
      },
    ])
  );
  assert.match(scoped.css, /--spacing-md: 16px;/);
  assert.deepEqual(scoped.warnings, []);

  const ambiguous = emitTokensCss(
    index([
      {
        key: "K2",
        name: "ratio/golden",
        resolvedType: "FLOAT",
        valuesByMode: { light: { kind: "number", value: 1.618 } },
      },
    ])
  );
  assert.match(ambiguous.css, /--ratio-golden: 1\.618;/);
  assert.ok(ambiguous.warnings.some((w) => w.includes("no dimensional scope")));
});

test("a translucent colour is emitted without inventing an opaque hex", () => {
  const { css } = emitTokensCss(
    index([
      {
        key: "K1",
        name: "color/overlay",
        resolvedType: "COLOR",
        valuesByMode: { light: { kind: "color", hex: "#000000", alpha: 0.5 } },
      },
    ])
  );
  assert.match(css, /--color-overlay: color-mix\(in srgb, #000000 50%, transparent\);/);
});

test("text styles become utility classes with real metrics", () => {
  const { css } = emitTokensCss(
    index(
      [],
      [
        {
          key: "S1",
          name: "heading/xl",
          fontFamily: "Inter",
          fontStyle: "SemiBold",
          fontSize: 24,
          lineHeight: 32,
          letterSpacing: -0.5,
          metricsResolved: true,
        },
      ]
    )
  );
  assert.match(css, /\.text-heading-xl \{/);
  assert.match(css, /font-size: 24px;/);
  assert.match(css, /line-height: 32px;/);
  assert.match(css, /font-weight: 600;/);
  assert.match(css, /letter-spacing: -0\.5px;/);
});

test("text styles with unresolved metrics are skipped and reported", () => {
  const { css, warnings } = emitTokensCss(
    index(
      [],
      [
        {
          key: "S1",
          name: "heading/xl",
          fontFamily: "Inter",
          fontStyle: "Regular",
          fontSize: 14,
          lineHeight: 20,
          metricsResolved: false,
        },
      ]
    )
  );
  assert.doesNotMatch(css, /\.text-heading-xl/);
  assert.ok(warnings.some((w) => w.includes("1 text style(s) skipped")));
});

test("a percentage line height is preserved as a ratio", () => {
  const { css } = emitTokensCss(
    index(
      [],
      [
        {
          key: "S1",
          name: "body/md",
          fontFamily: "Inter",
          fontStyle: "Regular",
          fontSize: 16,
          lineHeight: "150%",
          metricsResolved: true,
        },
      ]
    )
  );
  assert.match(css, /line-height: 150%;/);
});
