// ---------------------------------------------------------------------------
// detokenize.ts — inverse resolve: Figma node tree → scene graph
// ---------------------------------------------------------------------------
//
// The compiler goes `$token → registry key → Plugin API call`. This module runs
// that arrow backwards: `bound variable → registry key → $token`.
//
// **Zero inference is the whole point.** A value bound to a DS variable or
// style converts deterministically, because the binding *is* the answer. A raw
// value — a hand-typed hex, a nudged padding — is imported verbatim and
// reported as a FLAG. It is never matched to the "nearest" token, which is why
// `ImportFlag.suggestion` is typed as `null` rather than as an optional string:
// there is no code path that could ever fill it, and the type says so.
//
// The consequence is deliberate: a scene graph carrying raw values does not
// compile. Two different mechanisms enforce that, and it is worth knowing
// which is which when reading a FLAG:
//
//   - a numeric `gap` / `padding*` / `radius*` fails schema validation, whose
//     `checkString` types those fields as token refs (PARSE_MISSING_FIELD);
//   - a hex `fill` / `stroke` is a string, so it clears the schema and is
//     caught instead by the compile-time lint rule `no-hardcoded-hex`
//     (severity error). Without lint, codegen simply emits no fill for it.
//
// Import's job is to hand the user a spec plus an exact list of what must be
// tokenised before it will build — not to silently produce something that
// compiles into a different design.

import type { Registry } from "../compiler/registry.js";
import type { SceneGraph, SceneNode } from "../compiler/types.js";
import { rgbaToHex } from "../kb/values.js";
import type { SnapshotNode, SnapshotPaint, SnapshotTree, SnapshotVariableRef } from "./snapshot.js";

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * One unresolvable value. Every FLAG is an instruction to a human: "this pixel
 * came from nowhere in the design system — decide what it should be".
 */
export interface ImportFlag {
  /** Human-readable ancestry, e.g. `"Card > Header > Title"`. */
  nodePath: string;
  nodeName: string;
  /** Scene-graph field the value would occupy: `fill`, `gap`, `textStyle`, … */
  field: string;
  rawValue: unknown;
  reason: string;
  /** Always null. See the module header: import never guesses a token. */
  suggestion: null;
}

export interface ImportResult {
  sceneGraph: SceneGraph;
  flags: ImportFlag[];
  /** Lossy-but-not-flagged conversions: skipped nodes, dropped enum values. */
  warnings: string[];
  stats: { nodes: number; tokensResolved: number; flagged: number };
}

// ─── Mapping tables ───────────────────────────────────────────────────────────

/** Figma container types that all become a scene-graph FRAME. */
const CONTAINER_TYPES: readonly string[] = [
  "FRAME",
  "COMPONENT",
  "COMPONENT_SET",
  "GROUP",
  "SECTION",
];

/**
 * Figma `boundVariables` field → scene-graph field, for the numeric properties.
 *
 * Note the corner-radius asymmetry: Figma names them `topLeftRadius`, the
 * scene graph names them `radiusTopLeft`. That is not a typo on either side —
 * it is why this table exists instead of a pass-through.
 */
// `category` names the token namespace the field's ref is written under. It is
// a property of the field, not of the value, so it is fixed here rather than
// derived at import time.
const NUMERIC_FIELDS: readonly { figma: string; scene: string; category: TokenCategory }[] = [
  { figma: "itemSpacing", scene: "gap", category: "spacing" },
  { figma: "paddingTop", scene: "paddingTop", category: "spacing" },
  { figma: "paddingRight", scene: "paddingRight", category: "spacing" },
  { figma: "paddingBottom", scene: "paddingBottom", category: "spacing" },
  { figma: "paddingLeft", scene: "paddingLeft", category: "spacing" },
  { figma: "cornerRadius", scene: "radius", category: "radius" },
  { figma: "topLeftRadius", scene: "radiusTopLeft", category: "radius" },
  { figma: "topRightRadius", scene: "radiusTopRight", category: "radius" },
  { figma: "bottomLeftRadius", scene: "radiusBottomLeft", category: "radius" },
  { figma: "bottomRightRadius", scene: "radiusBottomRight", category: "radius" },
];

const LAYOUT_MODES: readonly string[] = ["HORIZONTAL", "VERTICAL"];
const AUTO_RESIZE_MODES: readonly string[] = ["HEIGHT", "WIDTH_AND_HEIGHT", "NONE"];

/** Message tail shared by every raw-value FLAG, stated once. */
const COMPILE_WARNING = "raw value imported as-is; compile will reject it until it is tokenised";

/**
 * Explains the one failure mode that looks like a bug but is not: the binding
 * exists, the variable exists in Figma, and the registry still cannot see it.
 */
const ID_KEY_GAP =
  "Figma exposes session-local variable ids while variables.json indexes library keys — " +
  "re-run extraction so it records the variable key " +
  "(figma.variables.getVariableByIdAsync(id).key), or resync the KB";

// ─── Reverse indexes ──────────────────────────────────────────────────────────

/**
 * The registry is built for forward lookups (`name → key`); import needs the
 * opposite. Building the inverse here rather than in `registry.ts` keeps the
 * compiler's load path untouched — import is the only consumer.
 */
interface ReverseMaps {
  variableByKey: Map<string, string>;
  textStyleByKey: Map<string, string>;
  componentByKey: Map<string, string>;
}

function buildReverseMaps(registry: Registry): ReverseMaps {
  const variableByKey = new Map<string, string>();
  for (const entry of registry.variables.byName.values()) {
    if (entry.key) variableByKey.set(entry.key, entry.name);
  }

  const textStyleByKey = new Map<string, string>();
  for (const entry of registry.textStyles.byName.values()) {
    if (entry.key) textStyleByKey.set(entry.key, entry.name);
  }

  // components.byName is keyed by the *lowercased* name; entry.name holds the
  // authoritative casing, which is what a `component:` ref must carry.
  const componentByKey = new Map<string, string>();
  for (const entry of registry.components.byName.values()) {
    if (entry.key) componentByKey.set(entry.key, entry.name);
  }
  for (const index of [registry.icons, registry.logos]) {
    for (const entry of index.byName.values()) {
      if (entry.key && !componentByKey.has(entry.key)) componentByKey.set(entry.key, entry.name);
    }
  }

  return { variableByKey, textStyleByKey, componentByKey };
}

// ─── Walk context ─────────────────────────────────────────────────────────────

interface Ctx {
  reverse: ReverseMaps;
  flags: ImportFlag[];
  warnings: string[];
  nodes: number;
  tokensResolved: number;
}

function flag(
  ctx: Ctx,
  node: SnapshotNode,
  path: string,
  field: string,
  rawValue: unknown,
  reason: string
): void {
  ctx.flags.push({
    nodePath: path,
    nodeName: node.name,
    field,
    rawValue,
    reason,
    suggestion: null,
  });
}

// ─── Binding resolution ───────────────────────────────────────────────────────

/**
 * Read the variable bound to `field`, normalising the two shapes the Plugin API
 * uses: a single alias for scalars, an array for `fills` / `strokes`. Only the
 * first entry of an array is considered — the scene graph has one `fill` per
 * node, so a stacked paint list cannot round-trip anyway.
 */
function bindingFor(node: SnapshotNode, field: string): SnapshotVariableRef | undefined {
  const raw = node.boundVariables?.[field];
  if (!raw) return undefined;
  const ref = Array.isArray(raw) ? raw[0] : raw;
  return ref && typeof ref.id === "string" ? ref : undefined;
}

/**
 * Resolve a binding to a registry name, trying `key` then `id`.
 *
 * The `id` fallback is not a guess: some KBs (the MCP extraction path) store
 * the variable id in the `key` field, so the same map answers both. When
 * neither hits, we return null and the caller flags — we never scan for a
 * similarly-named variable.
 */
function resolveByKeyOrId(ref: SnapshotVariableRef, map: Map<string, string>): string | null {
  if (ref.key && map.has(ref.key)) return map.get(ref.key)!;
  if (map.has(ref.id)) return map.get(ref.id)!;
  return null;
}

function describeRef(ref: SnapshotVariableRef): string {
  return ref.key ? `id "${ref.id}" / key "${ref.key}"` : `id "${ref.id}" (no key recorded)`;
}

/**
 * Build the `$token` reference the compiler will accept for a registry name.
 *
 * Two things happen here, and neither is a guess:
 *
 * 1. **A category prefix is prepended.** `resolve()` maps the first segment of
 *    a ref to a registry (`color`/`spacing`/`radius` → variables, `text` →
 *    text styles) and uses it to bias scoring. The category comes from the
 *    *field* being imported — a fill is a colour, a gap is spacing — so it is
 *    read off the structure, never inferred from the value.
 *
 * 2. **Decorative prefixes are stripped.** Published libraries name entries
 *    `🌀 tailwind/sans/lg/normal`; the emoji is not part of the token path and
 *    a ref carrying it fails to resolve. Authored specs write
 *    `$text/tailwind/sans/xs/semiBold`, which is what this reproduces.
 *
 * The prefix is skipped when the name already opens with that category, so a
 * variable called `radius/boxes` yields `$radius/boxes` rather than the
 * redundant `$radius/radius/boxes`. Both forms resolve, but only the first
 * matches how the specs are written by hand.
 */
function tokenRef(category: TokenCategory, registryName: string): string {
  const segments = registryName
    .split("/")
    .map((segment) => segment.replace(/^[^\p{L}\p{N}$]+/u, "").trim())
    .filter((segment) => segment.length > 0);

  if (segments[0]?.toLowerCase() === category) return `$${segments.join("/")}`;
  return `$${category}/${segments.join("/")}`;
}

/**
 * Which token namespace a scene-graph field belongs to. Fixed per field, so the
 * mapping is a lookup rather than a judgement about the value.
 */
export type TokenCategory = "color" | "spacing" | "radius" | "text" | "effect";

// ─── Paint handling ───────────────────────────────────────────────────────────

/** First paint that would actually render. Hidden paints carry no design intent. */
function firstVisiblePaint(paints: SnapshotPaint[] | undefined): SnapshotPaint | undefined {
  if (!Array.isArray(paints)) return undefined;
  return paints.find((p) => p && p.visible !== false);
}

/**
 * Represent a raw paint for the FLAG and for the node. A SOLID paint becomes
 * its hex — a lossless re-encoding of the same numbers, not an interpretation.
 * Anything else (gradient, image) is passed through untouched.
 */
function rawPaintValue(paint: SnapshotPaint): unknown {
  if (paint.type === "SOLID" && paint.color) return rgbaToHex(paint.color).hex;
  return paint;
}

/**
 * Apply a paint-bearing field (`fills` → `fill`, `strokes` → `stroke`).
 *
 * Two binding shapes are checked: node-level (`boundVariables.fills`) and
 * paint-level (`fills[0].boundVariables.color`). Real files contain both,
 * depending on how the value was set.
 */
function applyPaintField(
  ctx: Ctx,
  node: SnapshotNode,
  path: string,
  out: SceneNode,
  figmaField: "fills" | "strokes",
  sceneField: "fill" | "stroke"
): void {
  const paints = node[figmaField];
  const paint = firstVisiblePaint(paints);
  const ref = bindingFor(node, figmaField) ?? paint?.boundVariables?.color;

  if (ref) {
    const name = resolveByKeyOrId(ref, ctx.reverse.variableByKey);
    if (name) {
      out[sceneField] = tokenRef("color", name);
      ctx.tokensResolved++;
      return;
    }
    const raw = paint ? rawPaintValue(paint) : null;
    if (raw !== null) out[sceneField] = raw as string;
    flag(
      ctx,
      node,
      path,
      sceneField,
      raw,
      `${sceneField} is bound to variable ${describeRef(ref)}, which is not in the registry — ` +
        `${ID_KEY_GAP}. ${COMPILE_WARNING}`
    );
    return;
  }

  if (!paint) return;

  const raw = rawPaintValue(paint);
  out[sceneField] = raw as string;
  flag(
    ctx,
    node,
    path,
    sceneField,
    raw,
    `${sceneField} is not bound to a design-system variable — ${COMPILE_WARNING}`
  );
}

// ─── Numeric fields ───────────────────────────────────────────────────────────

/**
 * Apply one numeric field. A zero is treated as "absent": zero padding, zero
 * gap and zero radius are the Figma defaults, they encode no design decision,
 * and flagging every one of them would bury the flags that matter.
 */
function applyNumericField(
  ctx: Ctx,
  node: SnapshotNode,
  path: string,
  out: SceneNode,
  figmaField: string,
  sceneField: string,
  category: TokenCategory = "spacing"
): void {
  const ref = bindingFor(node, figmaField);
  const raw = (node as unknown as Record<string, unknown>)[figmaField];

  if (ref) {
    const name = resolveByKeyOrId(ref, ctx.reverse.variableByKey);
    if (name) {
      out[sceneField] = tokenRef(category, name);
      ctx.tokensResolved++;
      return;
    }
    if (typeof raw === "number") out[sceneField] = raw;
    flag(
      ctx,
      node,
      path,
      sceneField,
      raw ?? null,
      `${sceneField} is bound to variable ${describeRef(ref)}, which is not in the registry — ` +
        `${ID_KEY_GAP}. ${COMPILE_WARNING}`
    );
    return;
  }

  if (typeof raw !== "number" || raw === 0) return;

  out[sceneField] = raw;
  flag(
    ctx,
    node,
    path,
    sceneField,
    raw,
    `${sceneField} is not bound to a design-system variable — ${COMPILE_WARNING}`
  );
}

// ─── Per-kind conversion ──────────────────────────────────────────────────────

function applyCommon(ctx: Ctx, node: SnapshotNode, path: string, out: SceneNode): void {
  if (node.visible === false) out.visible = false;
  if (typeof node.opacity === "number" && node.opacity !== 1) out.opacity = node.opacity;
  if (node.layoutSizingHorizontal === "FILL") out.fillH = true;
  if (node.layoutSizingVertical === "FILL") out.fillV = true;

  applyPaintField(ctx, node, path, out, "fills", "fill");
  applyPaintField(ctx, node, path, out, "strokes", "stroke");

  // strokeWeight and strokeAlign are typed as a number / an enum in the scene
  // graph, so they have no token form to convert to — they copy through.
  if (out.stroke !== undefined) {
    if (typeof node.strokeWeight === "number") out.strokeWeight = node.strokeWeight;
    if (typeof node.strokeAlign === "string") out.strokeAlign = node.strokeAlign;
  }
}

function applyFrame(ctx: Ctx, node: SnapshotNode, path: string, out: SceneNode): void {
  const layout = LAYOUT_MODES.includes(node.layoutMode ?? "") ? node.layoutMode! : "NONE";
  out.layout = layout;

  if (layout !== "NONE") {
    if (node.primaryAxisSizingMode) out.primaryAxisSizing = node.primaryAxisSizingMode;
    if (node.counterAxisSizingMode) out.counterAxisSizing = node.counterAxisSizingMode;
    if (node.primaryAxisAlignItems) out.primaryAxisAlign = node.primaryAxisAlignItems;
    if (node.counterAxisAlignItems) out.counterAxisAlign = node.counterAxisAlignItems;
  }

  if (typeof node.clipsContent === "boolean") out.clip = node.clipsContent;

  for (const { figma, scene, category } of NUMERIC_FIELDS) {
    // A frame with no auto-layout has no gap or padding to speak of; Figma
    // still reports stale numbers from a previous layout mode.
    if (layout === "NONE" && (scene === "gap" || scene.startsWith("padding"))) continue;
    applyNumericField(ctx, node, path, out, figma, scene, category);
  }
}

function applyText(ctx: Ctx, node: SnapshotNode, path: string, out: SceneNode): void {
  out.characters = node.characters ?? "";

  if (node.textAutoResize) {
    if (AUTO_RESIZE_MODES.includes(node.textAutoResize)) {
      out.autoResize = node.textAutoResize;
    } else {
      ctx.warnings.push(
        `${path}: textAutoResize "${node.textAutoResize}" has no scene-graph equivalent — dropped`
      );
    }
  }

  if (node.textStyleKey || node.textStyleId) {
    const ref: SnapshotVariableRef = {
      id: node.textStyleId ?? node.textStyleKey!,
      ...(node.textStyleKey ? { key: node.textStyleKey } : {}),
    };
    const name = resolveByKeyOrId(ref, ctx.reverse.textStyleByKey);
    if (name) {
      out.textStyle = tokenRef("text", name);
      ctx.tokensResolved++;
      return;
    }
    flag(
      ctx,
      node,
      path,
      "textStyle",
      node.textStyleKey ?? node.textStyleId ?? null,
      `text style ${describeRef(ref)} is not in the text-styles registry — ${ID_KEY_GAP}. ` +
        `${COMPILE_WARNING}`
    );
    return;
  }

  flag(
    ctx,
    node,
    path,
    "textStyle",
    null,
    `text has no design-system text style applied — ${COMPILE_WARNING}`
  );
}

function applyInstance(ctx: Ctx, node: SnapshotNode, path: string, out: SceneNode): void {
  if (node.variantProperties && Object.keys(node.variantProperties).length > 0) {
    out.variant = { ...node.variantProperties };
  }

  const key = node.componentKey ?? node.mainComponentKey;
  if (!key) {
    flag(
      ctx,
      node,
      path,
      "component",
      null,
      `instance carries no component key — extraction must record ` +
        `(await node.getMainComponentAsync())?.key. ${COMPILE_WARNING}`
    );
    return;
  }

  const name = ctx.reverse.componentByKey.get(key);
  if (name) {
    // The compiler resolves `component:` by bare registry name, not by a
    // `$comp/` ref — see resolveComponent() in lib/compiler/resolve.ts.
    out.component = name;
    ctx.tokensResolved++;
    return;
  }

  flag(
    ctx,
    node,
    path,
    "component",
    key,
    `component key "${key}" is not in the components registry — the instance may come from ` +
      `outside the design system, or the KB may be stale (run a resync). ${COMPILE_WARNING}`
  );
}

function applyShape(ctx: Ctx, node: SnapshotNode, path: string, out: SceneNode): void {
  // width/height are required on RECTANGLE/ELLIPSE by the scene-graph schema.
  out.width = typeof node.width === "number" ? node.width : 0;
  out.height = typeof node.height === "number" ? node.height : 0;

  applyNumericField(ctx, node, path, out, "cornerRadius", "radius");
}

// ─── Node walk ────────────────────────────────────────────────────────────────

/**
 * Convert one snapshot node. Returns null when the node has no scene-graph
 * equivalent — vectors, lines, boolean operations. Those are flagged and
 * skipped rather than approximated, and their subtree goes with them: a child
 * of a dropped node has no place to live.
 */
function convertNode(ctx: Ctx, node: SnapshotNode, parentPath: string): SceneNode | null {
  const name = node.name || "(unnamed)";
  const path = parentPath ? `${parentPath} > ${name}` : name;

  // Deliberately no `id`: Figma node ids are session-scoped, and a spec that
  // embeds one stops being reproducible. Iron law of the project.
  const out: SceneNode = { type: "FRAME", name };

  if (node.type === "TEXT") {
    out.type = "TEXT";
    applyCommon(ctx, node, path, out);
    applyText(ctx, node, path, out);
  } else if (node.type === "INSTANCE") {
    out.type = "INSTANCE";
    applyCommon(ctx, node, path, out);
    applyInstance(ctx, node, path, out);
  } else if (node.type === "RECTANGLE" || node.type === "ELLIPSE") {
    out.type = node.type;
    applyCommon(ctx, node, path, out);
    applyShape(ctx, node, path, out);
  } else if (CONTAINER_TYPES.includes(node.type)) {
    out.type = "FRAME";
    if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
      // Importing a master as a FRAME loses its variant matrix. Saying so is
      // cheaper than half-reconstructing a COMPONENT_SET we cannot verify.
      ctx.warnings.push(`${path}: ${node.type} imported as a FRAME — variant axes are not carried`);
    }
    applyCommon(ctx, node, path, out);
    applyFrame(ctx, node, path, out);
  } else {
    flag(
      ctx,
      node,
      path,
      "type",
      node.type,
      `Figma node type "${node.type}" has no scene-graph equivalent — node and its subtree skipped`
    );
    return null;
  }

  ctx.nodes++;

  // INSTANCE children are overrides of the master's own subtree; re-emitting
  // them would duplicate what instantiating the component already produces.
  if (out.type !== "INSTANCE" && Array.isArray(node.children) && node.children.length > 0) {
    const children: SceneNode[] = [];
    for (const child of node.children) {
      const converted = convertNode(ctx, child, path);
      if (converted) children.push(converted);
    }
    if (children.length > 0) out.children = children;
  }

  return out;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Turn an extracted Figma tree into a scene graph, reporting every value that
 * is not backed by the design system.
 *
 * Never throws on unbound values — an import that refuses to produce output
 * teaches the user nothing. It produces the graph *and* the list of what is
 * wrong with it.
 */
export function detokenize(
  tree: SnapshotTree,
  registry: Registry,
  opts?: { name?: string }
): ImportResult {
  const ctx: Ctx = {
    reverse: buildReverseMaps(registry),
    flags: [],
    warnings: [],
    nodes: 0,
    tokensResolved: 0,
  };

  const root = convertNode(ctx, tree, "");
  const nodes = root ? [root] : [];

  const sceneGraph: SceneGraph = {
    version: "3.0",
    metadata: {
      name: opts?.name ?? tree.name ?? "imported",
      width: typeof tree.width === "number" ? tree.width : 0,
      height: typeof tree.height === "number" ? tree.height : 0,
    },
    // Left empty on purpose: the compiler re-derives the font list from the
    // text styles it resolves, so anything we wrote here would be a second,
    // drift-prone source for the same fact.
    fonts: [],
    nodes,
  };

  return {
    sceneGraph,
    flags: ctx.flags,
    warnings: ctx.warnings,
    stats: { nodes: ctx.nodes, tokensResolved: ctx.tokensResolved, flagged: ctx.flags.length },
  };
}
