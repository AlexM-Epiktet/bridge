import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSceneGraph } from "./schema.js";
import { generateCode } from "./codegen.js";
import type { Chunk } from "./plan.js";
import type { SceneNode } from "./types.js";

/** Wrap nodes in a minimal valid scene-graph envelope. */
function graph(nodes: unknown[]): unknown {
  return {
    version: "3.0",
    metadata: { name: "Test", width: 400, height: 300 },
    fonts: [],
    nodes,
  };
}

/** Emit a single chunk with no imports, so assertions read the raw calls. */
function emit(nodes: SceneNode[]): string {
  const chunk: Chunk = {
    index: 0,
    label: "build-0",
    imports: { variables: [], components: [], textStyles: [] },
    nodes,
    bridgeExports: [],
    bridgeImports: [],
  };
  return generateCode(chunk, { rootName: "Test", rootWidth: 400, rootHeight: 300 });
}

const buttonSet = {
  type: "COMPONENT_SET",
  name: "Button",
  variantProperties: [
    { name: "variant", values: ["primary", "secondary"], default: "primary" },
    { name: "size", values: ["sm", "md"] },
  ],
  children: [
    {
      type: "COMPONENT",
      name: "Primary Small",
      variantValues: { variant: "primary", size: "sm" },
      layout: "HORIZONTAL",
      children: [],
    },
    {
      type: "COMPONENT",
      name: "Primary Medium",
      variantValues: { variant: "primary", size: "md" },
      layout: "HORIZONTAL",
      children: [],
    },
    {
      type: "COMPONENT",
      name: "Secondary Small",
      variantValues: { variant: "secondary", size: "sm" },
      layout: "HORIZONTAL",
      children: [],
    },
    {
      type: "COMPONENT",
      name: "Secondary Medium",
      variantValues: { variant: "secondary", size: "md" },
      layout: "HORIZONTAL",
      children: [],
    },
  ],
};

// ─── Schema ──────────────────────────────────────────────────────────────────

test("a well-formed COMPONENT_SET passes schema validation", () => {
  const result = validateSceneGraph(graph([buttonSet]));
  assert.deepEqual(
    result.errors.map((e) => e.message),
    []
  );
  assert.equal(result.valid, true);
});

test("a COMPONENT_SET without variant axes is rejected", () => {
  const result = validateSceneGraph(
    graph([
      {
        type: "COMPONENT_SET",
        name: "Button",
        children: [{ type: "COMPONENT", name: "A", variantValues: {} }],
      },
    ])
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.message.includes("variantProperties")));
});

test("a variant missing a value for a declared axis is rejected", () => {
  const result = validateSceneGraph(
    graph([
      {
        type: "COMPONENT_SET",
        name: "Button",
        variantProperties: [
          { name: "variant", values: ["primary"] },
          { name: "size", values: ["sm"] },
        ],
        children: [{ type: "COMPONENT", name: "A", variantValues: { variant: "primary" } }],
      },
    ])
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.message.includes('missing a value for axis "size"')));
});

test("two variants with the same combination are rejected", () => {
  const result = validateSceneGraph(
    graph([
      {
        type: "COMPONENT_SET",
        name: "Button",
        variantProperties: [{ name: "variant", values: ["primary"] }],
        children: [
          { type: "COMPONENT", name: "A", variantValues: { variant: "primary" } },
          { type: "COMPONENT", name: "B", variantValues: { variant: "primary" } },
        ],
      },
    ])
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.message.includes("same combination")));
});

test("a COMPONENT_SET may only contain COMPONENT children", () => {
  const result = validateSceneGraph(
    graph([
      {
        type: "COMPONENT_SET",
        name: "Button",
        variantProperties: [{ name: "variant", values: ["primary"] }],
        children: [{ type: "FRAME", name: "Nope" }],
      },
    ])
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.message.includes("may only contain COMPONENT children")));
});

test("an unknown component-property type is rejected", () => {
  const result = validateSceneGraph(
    graph([
      {
        type: "COMPONENT",
        name: "Badge",
        componentProperties: [{ name: "label", type: "NUMBER" }],
      },
    ])
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.message.includes("TEXT, BOOLEAN, INSTANCE_SWAP")));
});

test("a component property bound to a layer must name that layer", () => {
  const result = validateSceneGraph(
    graph([
      {
        type: "COMPONENT",
        name: "Badge",
        componentProperties: [{ name: "label", type: "TEXT", bindTo: { field: "characters" } }],
      },
    ])
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.message.includes('"layer"')));
});

// ─── Codegen ─────────────────────────────────────────────────────────────────

test("a component set creates every variant then combines them once", () => {
  const code = emit([buttonSet as unknown as SceneNode]);

  assert.equal((code.match(/figma\.createComponent\(\)/g) ?? []).length, 4);
  assert.equal((code.match(/figma\.combineAsVariants/g) ?? []).length, 1);

  // Variant names are the matrix coordinates, ordered by the axis declaration.
  assert.ok(code.includes('"variant=primary, size=sm"'));
  assert.ok(code.includes('"variant=secondary, size=md"'));

  // The set is named after the combine, because it does not exist before it.
  const combineAt = code.indexOf("combineAsVariants");
  const setNameAt = code.indexOf('.name = "Button"');
  assert.ok(combineAt < setNameAt, "the set must be named after it is combined");
});

test("variant naming follows the axis order, not the authoring order", () => {
  const code = emit([
    {
      type: "COMPONENT_SET",
      name: "Chip",
      variantProperties: [
        { name: "tone", values: ["neutral"] },
        { name: "state", values: ["on"] },
      ],
      children: [{ type: "COMPONENT", name: "A", variantValues: { state: "on", tone: "neutral" } }],
    } as unknown as SceneNode,
  ]);
  assert.ok(code.includes('"tone=neutral, state=on"'));
});

test("component properties are added to the set and bound to a layer", () => {
  const code = emit([
    {
      type: "COMPONENT_SET",
      name: "Button",
      variantProperties: [{ name: "variant", values: ["primary"] }],
      componentProperties: [
        { name: "label", type: "TEXT", default: "Click me", bindTo: { layer: "Label" } },
      ],
      children: [
        {
          type: "COMPONENT",
          name: "Primary",
          variantValues: { variant: "primary" },
          children: [
            { type: "TEXT", name: "Label", characters: "Click me", textStyle: "$text/body/md" },
          ],
        },
      ],
    } as unknown as SceneNode,
  ]);

  assert.ok(code.includes('.addComponentProperty("label", "TEXT", "Click me")'));
  // The binding must reuse the key Figma returned, not the bare property name.
  assert.match(code, /componentPropertyReferences = \{ characters: cp_\w+ \}/);
  assert.ok(code.includes('n.name === "Label"'));
});

test("a BOOLEAN property defaults to driving visibility", () => {
  const code = emit([
    {
      type: "COMPONENT",
      name: "Badge",
      componentProperties: [
        { name: "showIcon", type: "BOOLEAN", default: false, bindTo: { layer: "Icon" } },
      ],
      children: [],
    } as unknown as SceneNode,
  ]);
  assert.ok(code.includes('.addComponentProperty("showIcon", "BOOLEAN", false)'));
  assert.match(code, /componentPropertyReferences = \{ visible: cp_\w+ \}/);
});

test("a standalone COMPONENT is created and appended like a frame", () => {
  const code = emit([
    {
      type: "COMPONENT",
      name: "Divider",
      layout: "HORIZONTAL",
      description: "A rule.",
      children: [],
    } as unknown as SceneNode,
  ]);
  assert.ok(code.includes("figma.createComponent()"));
  assert.ok(code.includes('.name = "Divider"'));
  assert.ok(code.includes('.layoutMode = "HORIZONTAL"'));
  assert.ok(code.includes('.description = "A rule."'));
  assert.ok(code.includes("root.appendChild("));
  assert.ok(!code.includes("combineAsVariants"));
});

test("an empty component set warns instead of emitting a broken combine", () => {
  const code = emit([
    {
      type: "COMPONENT_SET",
      name: "Empty",
      variantProperties: [{ name: "variant", values: ["a"] }],
      children: [],
    } as unknown as SceneNode,
  ]);
  assert.ok(code.includes("// WARN"));
  assert.ok(!code.includes("combineAsVariants"));
});
