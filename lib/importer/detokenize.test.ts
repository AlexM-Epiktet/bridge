import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  AssetEntry,
  ComponentEntry,
  Registry,
  TextStyleEntry,
  VariableEntry,
} from "../compiler/registry.js";
import type { SnapshotTree } from "./snapshot.js";
import { detokenize } from "./detokenize.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VARIABLES: VariableEntry[] = [
  { name: "spacing/md", key: "var-spacing-md", collection: "" },
  { name: "spacing/lg", key: "var-spacing-lg", collection: "" },
  { name: "color/bg/primary", key: "var-color-bg-primary", collection: "" },
  { name: "color/text/default", key: "var-color-text-default", collection: "" },
  // A KB produced by the MCP extraction path stores the session id in `key`.
  { name: "radius/sm", key: "VariableID:42:7", collection: "" },
];

const TEXT_STYLES: TextStyleEntry[] = [{ name: "text/heading/xl", key: "style-heading-xl" }];

const COMPONENTS: ComponentEntry[] = [
  { name: "Button", key: "comp-button", type: "COMPONENT_SET", properties: {} },
];

function emptyAssetIndex(): { byName: Map<string, AssetEntry> } {
  return { byName: new Map<string, AssetEntry>() };
}

/** Minimal Registry matching lib/compiler/registry.ts. `bySegment` is unused by
 * import (it exists for fuzzy forward matching) so it stays empty. */
function makeRegistry(): Registry {
  return {
    variables: {
      byName: new Map(VARIABLES.map((v) => [v.name, v])),
      bySegment: new Map(),
    },
    components: {
      byName: new Map(COMPONENTS.map((c) => [c.name.toLowerCase(), c])),
    },
    textStyles: {
      byName: new Map(TEXT_STYLES.map((s) => [s.name, s])),
      bySegment: new Map(),
    },
    icons: emptyAssetIndex(),
    logos: emptyAssetIndex(),
    allVariableNames: VARIABLES.map((v) => v.name),
    allComponentNames: COMPONENTS.map((c) => c.name.toLowerCase()),
    allStyleNames: TEXT_STYLES.map((s) => s.name),
  };
}

/** A tree drawn entirely with design-system tokens. */
function boundTree(): SnapshotTree {
  return {
    id: "1:1",
    name: "Card",
    type: "FRAME",
    width: 320,
    height: 200,
    layoutMode: "VERTICAL",
    itemSpacing: 16,
    paddingTop: 24,
    primaryAxisSizingMode: "AUTO",
    counterAxisAlignItems: "CENTER",
    clipsContent: true,
    fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
    boundVariables: {
      itemSpacing: { id: "VariableID:1:1", key: "var-spacing-md" },
      paddingTop: { id: "VariableID:1:2", key: "var-spacing-lg" },
      fills: [{ id: "VariableID:1:3", key: "var-color-bg-primary" }],
    },
    children: [
      {
        id: "1:2",
        name: "Title",
        type: "TEXT",
        characters: "Hello",
        textStyleId: "S:abc",
        textStyleKey: "style-heading-xl",
        textAutoResize: "HEIGHT",
        fills: [
          {
            type: "SOLID",
            color: { r: 0, g: 0, b: 0 },
            boundVariables: { color: { id: "VariableID:1:4", key: "var-color-text-default" } },
          },
        ],
      },
      {
        id: "1:3",
        name: "Confirm",
        type: "INSTANCE",
        componentKey: "comp-button",
        variantProperties: { variant: "primary", size: "md" },
      },
    ],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("a fully token-bound tree round-trips with zero flags", () => {
  const result = detokenize(boundTree(), makeRegistry());

  assert.deepEqual(result.flags, []);
  assert.equal(result.stats.flagged, 0);
  assert.equal(result.stats.nodes, 3);
  assert.equal(result.stats.tokensResolved, 6);

  const root = result.sceneGraph.nodes[0]!;
  assert.equal(result.sceneGraph.version, "3.0");
  assert.deepEqual(result.sceneGraph.metadata, { name: "Card", width: 320, height: 200 });
  assert.deepEqual(result.sceneGraph.fonts, []);

  assert.equal(root.type, "FRAME");
  assert.equal(root.layout, "VERTICAL");
  assert.equal(root.gap, "$spacing/md");
  assert.equal(root.paddingTop, "$spacing/lg");
  assert.equal(root.fill, "$color/bg/primary");
  assert.equal(root.primaryAxisSizing, "AUTO");
  assert.equal(root.counterAxisAlign, "CENTER");
  assert.equal(root.clip, true);

  const [title, confirm] = root.children!;
  assert.equal(title!.type, "TEXT");
  assert.equal(title!.characters, "Hello");
  assert.equal(title!.textStyle, "$text/heading/xl");
  assert.equal(title!.fill, "$color/text/default");
  assert.equal(title!.autoResize, "HEIGHT");

  assert.equal(confirm!.type, "INSTANCE");
  assert.equal(confirm!.component, "Button");
  assert.deepEqual(confirm!.variant, { variant: "primary", size: "md" });
});

test("a raw hex fill produces exactly one flag with suggestion === null", () => {
  const tree: SnapshotTree = {
    id: "2:1",
    name: "Banner",
    type: "FRAME",
    width: 100,
    height: 50,
    fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }],
  };

  const result = detokenize(tree, makeRegistry());

  assert.equal(result.flags.length, 1);
  const [flag] = result.flags;
  assert.equal(flag!.nodeName, "Banner");
  assert.equal(flag!.nodePath, "Banner");
  assert.equal(flag!.field, "fill");
  assert.equal(flag!.rawValue, "#ff0000");
  assert.equal(flag!.suggestion, null);
  assert.match(flag!.reason, /compile will reject it/);

  // The raw value is carried into the node as-is, so the later compile failure
  // points at the real problem instead of a silently-dropped colour.
  assert.equal(result.sceneGraph.nodes[0]!.fill, "#ff0000");
  assert.equal(result.stats.flagged, 1);
});

test("a binding resolvable only by id still resolves; one resolvable by neither is flagged", () => {
  const tree: SnapshotTree = {
    id: "3:1",
    name: "Tile",
    type: "FRAME",
    width: 80,
    height: 80,
    layoutMode: "HORIZONTAL",
    cornerRadius: 4,
    itemSpacing: 12,
    boundVariables: {
      // No `key` recorded — only the session-local id, which this KB happens
      // to store in its `key` column.
      cornerRadius: { id: "VariableID:42:7" },
      itemSpacing: { id: "VariableID:99:9", key: "var-that-does-not-exist" },
    },
  };

  const result = detokenize(tree, makeRegistry());

  const root = result.sceneGraph.nodes[0]!;
  assert.equal(root.radius, "$radius/sm");

  assert.equal(result.flags.length, 1);
  const [flag] = result.flags;
  assert.equal(flag!.field, "gap");
  assert.equal(flag!.rawValue, 12);
  assert.equal(flag!.suggestion, null);
  assert.match(flag!.reason, /session-local variable ids/);
  assert.match(flag!.reason, /library keys/);
  assert.match(flag!.reason, /VariableID:99:9/);

  // The raw number is still carried, so nothing about the design is lost.
  assert.equal(root.gap, 12);
});

test("an INSTANCE with an unknown componentKey flags instead of throwing", () => {
  const tree: SnapshotTree = {
    id: "4:1",
    name: "Row",
    type: "FRAME",
    width: 200,
    height: 40,
    children: [{ id: "4:2", name: "Mystery", type: "INSTANCE", componentKey: "comp-unknown" }],
  };

  const result = detokenize(tree, makeRegistry());

  assert.equal(result.flags.length, 1);
  const [flag] = result.flags;
  assert.equal(flag!.field, "component");
  assert.equal(flag!.nodePath, "Row > Mystery");
  assert.equal(flag!.rawValue, "comp-unknown");
  assert.equal(flag!.suggestion, null);

  // The node survives — only its component binding is missing.
  const instance = result.sceneGraph.nodes[0]!.children![0]!;
  assert.equal(instance.type, "INSTANCE");
  assert.equal(instance.component, undefined);
  assert.equal(result.stats.nodes, 2);
});

test("an unknown Figma node type is flagged and skipped", () => {
  const tree: SnapshotTree = {
    id: "5:1",
    name: "Art",
    type: "FRAME",
    width: 64,
    height: 64,
    children: [
      { id: "5:2", name: "Squiggle", type: "VECTOR" },
      {
        id: "5:3",
        name: "Label",
        type: "TEXT",
        characters: "hi",
        textStyleKey: "style-heading-xl",
      },
    ],
  };

  const result = detokenize(tree, makeRegistry());

  const typeFlags = result.flags.filter((f) => f.field === "type");
  assert.equal(typeFlags.length, 1);
  assert.equal(typeFlags[0]!.rawValue, "VECTOR");
  assert.equal(typeFlags[0]!.nodePath, "Art > Squiggle");
  assert.match(typeFlags[0]!.reason, /skipped/);

  const children = result.sceneGraph.nodes[0]!.children!;
  assert.equal(children.length, 1);
  assert.equal(children[0]!.name, "Label");
  // Skipped nodes are reported, never counted as imported.
  assert.equal(result.stats.nodes, 2);
});

test("Figma node ids never reach the scene graph", () => {
  const result = detokenize(boundTree(), makeRegistry());
  const serialized = JSON.stringify(result.sceneGraph);

  assert.ok(!serialized.includes('"id"'), "scene graph must not carry any id field");
  assert.ok(!serialized.includes("1:1"), "scene graph must not carry Figma node ids");
});

test("opts.name overrides the root node name in metadata", () => {
  const result = detokenize(boundTree(), makeRegistry(), { name: "product-card" });
  assert.equal(result.sceneGraph.metadata.name, "product-card");
});
