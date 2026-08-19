import { test } from "node:test";
import assert from "node:assert/strict";
import { emitAngularComponent, toKebabCase, toPascalCase } from "./angular.js";
import { buildTokenRefs } from "./token-refs.js";
import type { BindingIndex } from "./component-bindings.js";
import type { TokenValueIndex, TokenVariable, ThemeBinding } from "../kb/values.js";
import type { ResolvedSceneGraph, ResolvedNode } from "../compiler/types.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function valueIndex(variables: TokenVariable[], theme: ThemeBinding[]): TokenValueIndex {
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
    themeCssFile: null,
    modes: ["light"],
    defaultMode: "light",
    warnings: [],
  };
}

/** A KB shaped like the real one: colours bound by lockfile, spacing by name. */
const refs = buildTokenRefs(
  valueIndex(
    [
      { key: "KP", name: "main/color/primary/primary", resolvedType: "COLOR", valuesByMode: {} },
      { key: "KB1", name: "main/color/base/100", resolvedType: "COLOR", valuesByMode: {} },
      { key: "KBC", name: "main/color/base/content", resolvedType: "COLOR", valuesByMode: {} },
      { key: "KR", name: "radius/boxes", resolvedType: "FLOAT", valuesByMode: {} },
      { key: "KS4", name: "tailwind/spacing/4 (16)", resolvedType: "FLOAT", valuesByMode: {} },
      { key: "KS6", name: "tailwind/spacing/6 (24)", resolvedType: "FLOAT", valuesByMode: {} },
      { key: "KSEM", name: "space/form/field-gap", resolvedType: "FLOAT", valuesByMode: {} },
    ],
    [
      {
        cssVar: "--color-primary",
        figmaKey: "KP",
        figmaName: "main/color/primary/primary",
        cssValue: "oklch(52% .2 268)",
      },
      {
        cssVar: "--color-base-100",
        figmaKey: "KB1",
        figmaName: "main/color/base/100",
        cssValue: "oklch(98% 0 0)",
      },
      {
        cssVar: "--color-base-content",
        figmaKey: "KBC",
        figmaName: "main/color/base/content",
        cssValue: "oklch(27% 0 0)",
      },
      { cssVar: "--radius-box", figmaKey: "KR", figmaName: "radius/boxes", cssValue: "0.5rem" },
    ]
  )
);

/** Resolved tokens as they appear on a graph after the resolve stage. */
const tk = (key: string, name: string) => ({
  ref: `$${name}`,
  key,
  name,
  kind: "variable" as const,
  importMethod: null,
});

const bindings: BindingIndex = {
  byName: new Map([
    [
      "am-input-field",
      {
        selector: "am-input-field",
        lib: "@amelis/foundation/web-ui",
        sourcePath: null,
        kind: "component",
      },
    ],
  ]),
  byKey: new Map(),
  unusable: [],
};

function graph(nodes: ResolvedNode[]): ResolvedSceneGraph {
  return { version: "3.0", metadata: { name: "Card", width: 400, height: 300 }, fonts: [], nodes };
}

function emit(nodes: ResolvedNode[], opts = {}) {
  return emitAngularComponent(graph(nodes), refs, {
    name: "user-card",
    bindings,
    baseClass: { name: "BaseComponent", importPath: "@amelis/foundation/base" },
    ...opts,
  });
}

function fileNamed(
  result: { files: Array<{ path: string; content: string }> },
  suffix: string
): string {
  return result.files.find((f) => f.path.endsWith(suffix))!.content;
}

// ─── Naming ──────────────────────────────────────────────────────────────────

test("names follow the house convention", () => {
  assert.equal(toKebabCase("UserCard"), "user-card");
  assert.equal(toKebabCase("user card"), "user-card");
  assert.equal(toPascalCase("user-card"), "UserCard");
});

// ─── Layout ──────────────────────────────────────────────────────────────────

test("auto-layout becomes flex utilities on the host element", () => {
  const result = emit([
    {
      type: "FRAME",
      name: "Root",
      layout: "VERTICAL",
      primaryAxisAlign: "SPACE_BETWEEN",
      counterAxisAlign: "CENTER",
      gap: tk("KS4", "tailwind/spacing/4 (16)"),
      fill: tk("KB1", "main/color/base/100"),
      radius: tk("KR", "radius/boxes"),
      children: [],
    },
  ]);
  const ts = fileNamed(result, ".component.ts");
  assert.match(ts, /host: \{ class: '[^']*flex flex-col[^']*' \}/);
  assert.match(ts, /justify-between/);
  assert.match(ts, /items-center/);
  assert.match(ts, /gap-4/);
  assert.match(ts, /bg-base-100/);
  assert.match(ts, /rounded-box/);
});

test("uniform padding collapses to a single utility, split padding to axes", () => {
  const uniform = emit([
    {
      type: "FRAME",
      name: "Root",
      layout: "VERTICAL",
      paddingTop: tk("KS4", "tailwind/spacing/4 (16)"),
      paddingRight: tk("KS4", "tailwind/spacing/4 (16)"),
      paddingBottom: tk("KS4", "tailwind/spacing/4 (16)"),
      paddingLeft: tk("KS4", "tailwind/spacing/4 (16)"),
      children: [],
    },
  ]);
  assert.match(fileNamed(uniform, ".component.ts"), /\bp-4\b/);

  const axes = emit([
    {
      type: "FRAME",
      name: "Root",
      layout: "VERTICAL",
      paddingTop: tk("KS6", "tailwind/spacing/6 (24)"),
      paddingBottom: tk("KS6", "tailwind/spacing/6 (24)"),
      paddingRight: tk("KS4", "tailwind/spacing/4 (16)"),
      paddingLeft: tk("KS4", "tailwind/spacing/4 (16)"),
      children: [],
    },
  ]);
  const ts = fileNamed(axes, ".component.ts");
  assert.match(ts, /py-6/);
  assert.match(ts, /px-4/);
});

// ─── The refusal discipline ──────────────────────────────────────────────────

test("a semantic spacing token with no utility mapping is flagged, not approximated", () => {
  const result = emit([
    {
      type: "FRAME",
      name: "Root",
      layout: "VERTICAL",
      gap: tk("KSEM", "space/form/field-gap"),
      children: [],
    },
  ]);
  assert.equal(result.flags.length, 1);
  assert.equal(result.flags[0]?.role, "gap");
  assert.equal(result.flags[0]?.token, "space/form/field-gap");
  assert.match(result.flags[0]!.reason, /no Tailwind spacing step/);
  // Nothing invented in its place.
  assert.doesNotMatch(fileNamed(result, ".component.ts"), /gap-/);
});

test("an unmapped component becomes a marked gap, never an invented element", () => {
  const result = emit([
    {
      type: "FRAME",
      name: "Root",
      layout: "VERTICAL",
      children: [
        {
          type: "INSTANCE",
          name: "Widget",
          component: "$comp/am-mystery-widget",
          _resolvedComponent: {
            ref: "$comp/am-mystery-widget",
            key: "KX",
            name: "am-mystery-widget",
            kind: "component",
            importMethod: null,
          },
        },
      ],
    },
  ]);
  const html = fileNamed(result, ".component.html");
  assert.match(html, /<!-- bridge: unmapped component "am-mystery-widget" -->/);
  assert.ok(result.flags.some((f) => f.reason.includes("no Angular binding")));
});

// ─── Instances ───────────────────────────────────────────────────────────────

test("a bound component becomes its real selector and is imported once", () => {
  const result = emit([
    {
      type: "FRAME",
      name: "Root",
      layout: "VERTICAL",
      children: [
        {
          type: "INSTANCE",
          name: "Name",
          component: "$comp/am-input-field",
          _resolvedComponent: {
            ref: "$comp/am-input-field",
            key: "KI",
            name: "am-input-field",
            kind: "component",
            importMethod: null,
          },
          properties: { label: "Nom" },
        },
      ],
    },
  ]);
  assert.match(fileNamed(result, ".component.html"), /<am-input-field label="Nom" \/>/);
  const ts = fileNamed(result, ".component.ts");
  assert.match(ts, /import \{ AmInputField \} from '@amelis\/foundation\/web-ui';/);
  assert.match(ts, /imports: \[AmInputField\]/);
});

test("a framework primitive becomes a native element with modifier classes", () => {
  const result = emit([
    {
      type: "FRAME",
      name: "Root",
      layout: "VERTICAL",
      children: [
        {
          type: "INSTANCE",
          name: "Submit",
          component: "$comp/Button",
          _resolvedComponent: {
            ref: "$comp/Button",
            key: "KBTN",
            name: "Button",
            kind: "component",
            importMethod: null,
          },
          variant: { color: "primary", size: "sm" },
          properties: { label: "Envoyer" },
        },
      ],
    },
  ]);
  assert.match(
    fileNamed(result, ".component.html"),
    /<button class="btn btn-primary btn-sm">Envoyer<\/button>/
  );
  assert.equal(result.flags.length, 0);
});

test("decorative prefixes on real variant axes and properties are normalised", () => {
  const result = emit([
    {
      type: "FRAME",
      name: "Root",
      layout: "VERTICAL",
      children: [
        {
          type: "INSTANCE",
          name: "Voir",
          component: "$comp/Button",
          _resolvedComponent: {
            ref: "$comp/Button",
            key: "KBTN",
            name: "Button",
            kind: "component",
            importMethod: null,
          },
          // Exactly the shape a published Figma library produces.
          variant: { "🎨 color": "primary", "📐 size": "sm", "🌟 style": "default" },
          properties: { "↪ ✏️ label#6519:0": "Voir la fiche" },
        },
      ],
    },
  ]);
  const html = fileNamed(result, ".component.html");
  // The label comes from the property, not from the layer name.
  assert.match(html, />Voir la fiche</);
  assert.match(html, /class="btn btn-primary btn-sm"/);
  // "default" is the framework's unmodified state and must not become a class.
  assert.doesNotMatch(html, /btn-default/);
});

test("a bound component's attributes use normalised property names", () => {
  const result = emit([
    {
      type: "FRAME",
      name: "Root",
      layout: "VERTICAL",
      children: [
        {
          type: "INSTANCE",
          name: "Nom",
          component: "$comp/am-input-field",
          _resolvedComponent: {
            ref: "$comp/am-input-field",
            key: "KI",
            name: "am-input-field",
            kind: "component",
            importMethod: null,
          },
          properties: { "↪ ✏️ label#42:0": "Nom" },
        },
      ],
    },
  ]);
  assert.match(fileNamed(result, ".component.html"), /<am-input-field label="Nom" \/>/);
});

// ─── Text ────────────────────────────────────────────────────────────────────

test("typography utilities are read from the text style name", () => {
  const result = emit([
    {
      type: "FRAME",
      name: "Root",
      layout: "VERTICAL",
      children: [
        {
          type: "TEXT",
          name: "Title",
          characters: "Bonjour",
          textStyle: {
            ref: "$text/tailwind/sans/3xl/semibold",
            key: "TS",
            name: "🌀 tailwind/sans/3xl/semibold",
            kind: "textStyle",
            importMethod: null,
          },
          fill: tk("KBC", "main/color/base/content"),
        },
      ],
    },
  ]);
  const html = fileNamed(result, ".component.html");
  // Figma names the weight "semiBold"; the utility class is lower-case.
  assert.match(html, /class="text-3xl font-semibold text-base-content"/);
  assert.match(html, />Bonjour</);
});

test("a decorated text style name still yields typography utilities", () => {
  const result = emit([
    {
      type: "FRAME",
      name: "Root",
      layout: "VERTICAL",
      children: [
        {
          type: "TEXT",
          name: "T",
          characters: "x",
          textStyle: {
            ref: "$text/sans/lg",
            key: "TS3",
            name: "🌀 tailwind/sans/lg/normal",
            kind: "textStyle",
            importMethod: null,
          },
        },
      ],
    },
  ]);
  const html = fileNamed(result, ".component.html");
  assert.match(html, /class="text-lg"/);
  // "normal" is the default weight and adds no class.
  assert.doesNotMatch(html, /font-normal/);
  assert.equal(result.flags.length, 0);
});

test("a text style outside the tailwind namespace is flagged rather than guessed", () => {
  const result = emit([
    {
      type: "FRAME",
      name: "Root",
      layout: "VERTICAL",
      children: [
        {
          type: "TEXT",
          name: "Title",
          characters: "Hi",
          textStyle: {
            ref: "$text/heading/xl",
            key: "TS2",
            name: "heading/xl",
            kind: "textStyle",
            importMethod: null,
          },
        },
      ],
    },
  ]);
  assert.ok(result.flags.some((f) => f.reason.includes("not in the tailwind/* namespace")));
});

test("text content is escaped", () => {
  const result = emit([
    {
      type: "FRAME",
      name: "Root",
      layout: "VERTICAL",
      children: [{ type: "TEXT", name: "T", characters: "a < b & c" }],
    },
  ]);
  assert.match(fileNamed(result, ".component.html"), /a &lt; b &amp; c/);
});

// ─── Component API ───────────────────────────────────────────────────────────

test("a component set exposes its axes and properties as typed signal inputs", () => {
  const result = emit([
    {
      type: "COMPONENT_SET",
      name: "Button",
      variantProperties: [
        { name: "variant", values: ["primary", "secondary"], default: "primary" },
        { name: "size", values: ["sm", "md"] },
      ],
      componentProperties: [
        { name: "label", type: "TEXT", default: "Click" },
        { name: "showIcon", type: "BOOLEAN", default: false },
      ],
      children: [],
    },
  ]);
  const ts = fileNamed(result, ".component.ts");
  assert.match(
    ts,
    /public readonly variant: InputSignal<'primary' \| 'secondary'> = input<'primary' \| 'secondary'>\('primary'\);/
  );
  assert.match(
    ts,
    /public readonly size: InputSignal<'sm' \| 'md'> = input<'sm' \| 'md'>\('sm'\);/
  );
  assert.match(ts, /public readonly label: InputSignal<string> = input<string>\('Click'\);/);
  assert.match(ts, /public readonly showIcon: InputSignal<boolean> = input<boolean>\(false\);/);
  // Variants are not silently claimed to be wired.
  assert.ok(result.notes.some((n) => n.includes("per-variant class differences are not wired")));
});

// ─── House style ─────────────────────────────────────────────────────────────

test("the class file follows the house conventions", () => {
  const ts = fileNamed(
    emit([{ type: "FRAME", name: "Root", layout: "VERTICAL", children: [] }]),
    ".component.ts"
  );
  assert.match(ts, /selector: 'am-user-card',/);
  assert.match(ts, /export class AmUserCard extends BaseComponent \{\}/);
  assert.match(ts, /changeDetection: ChangeDetectionStrategy\.OnPush,/);
  assert.match(ts, /templateUrl: '\.\/user-card\.component\.html',/);
  // standalone is the default in modern Angular and must not be restated.
  assert.doesNotMatch(ts, /standalone/);
  // Tab indentation, single quotes.
  assert.match(ts, /\n\tselector:/);
});

test("files are colocated in a folder named after the component", () => {
  const result = emit([{ type: "FRAME", name: "Root", layout: "VERTICAL", children: [] }]);
  assert.deepEqual(result.files.map((f) => f.path).sort(), [
    "user-card/user-card.component.html",
    "user-card/user-card.component.stories.ts",
    "user-card/user-card.component.ts",
  ]);
});

test("the story is CSF3 with args covering every input", () => {
  const result = emit([
    {
      type: "COMPONENT_SET",
      name: "Button",
      variantProperties: [{ name: "variant", values: ["primary"], default: "primary" }],
      children: [],
    },
  ]);
  const story = fileNamed(result, ".stories.ts");
  assert.match(story, /const meta: Meta<AmUserCard> = \{/);
  assert.match(story, /provideZonelessChangeDetection\(\)/);
  assert.match(story, /variant: 'primary',/);
});

test("doc comments follow the requested language", () => {
  const fr = fileNamed(
    emit([{ type: "FRAME", name: "R", layout: "VERTICAL", children: [] }], { docLanguage: "fr" }),
    ".component.ts"
  );
  assert.match(fr, /Généré par Bridge/);
  const en = fileNamed(
    emit([{ type: "FRAME", name: "R", layout: "VERTICAL", children: [] }]),
    ".component.ts"
  );
  assert.match(en, /Generated by Bridge/);
});

test("the css-vars strategy emits declarations instead of utility classes", () => {
  const result = emit(
    [
      {
        type: "FRAME",
        name: "Root",
        layout: "VERTICAL",
        fill: tk("KB1", "main/color/base/100"),
        children: [],
      },
    ],
    { strategy: "css-vars" }
  );
  // No utility class for the fill; the styler produced a declaration instead.
  assert.doesNotMatch(fileNamed(result, ".component.ts"), /bg-base-100/);
});
