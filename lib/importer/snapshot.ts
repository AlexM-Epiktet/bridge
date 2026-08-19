// ---------------------------------------------------------------------------
// snapshot.ts — the Figma node-tree extraction contract
// ---------------------------------------------------------------------------
//
// A *snapshot* is the raw, un-interpreted result of walking a Figma selection
// with the Plugin API. It is produced in Figma (skill level, via MCP) and
// consumed offline by `detokenize()`. Keeping it a plain typed record is what
// makes import deterministic and testable without a Figma connection.
//
// Two rules govern this file:
//
//   1. **No interpretation.** Field names mirror the Plugin API one-for-one.
//      Nothing here is normalised, rounded, or mapped to Bridge vocabulary —
//      that is `detokenize()`'s job, and keeping the two apart is what lets us
//      prove the transform in tests.
//
//   2. **One source of truth.** `SNAPSHOT_FIELDS` is the list a skill reads to
//      generate the extraction script. The prose copies that used to live in
//      `generating-figma-design` and `learning-from-corrections` are meant to
//      be deleted in favour of it — two scripts drifting apart was the actual
//      bug this contract exists to prevent.

// ─── Primitives ───────────────────────────────────────────────────────────────

/**
 * A reference to a Figma variable, as carried by `node.boundVariables`.
 *
 * `id` is what the live Plugin API hands you, and it is **session-local**: it
 * identifies the variable inside the open file, not in the library. The KB's
 * `variables.json` indexes library *keys*. The two are different namespaces,
 * so the extraction script is required to resolve the key itself via
 * `(await figma.variables.getVariableByIdAsync(id))?.key` and record it here.
 *
 * `key` is therefore optional but strongly preferred: without it, a lookup can
 * only succeed on KBs that happen to store ids in the `key` field, and
 * everything else becomes a FLAG rather than a resolved token.
 */
export interface SnapshotVariableRef {
  id: string;
  key?: string;
}

/** Figma RGBA, channels as floats in [0, 1]. */
export interface SnapshotRGBA {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/**
 * One entry of a `fills` / `strokes` array.
 *
 * `boundVariables.color` is the per-paint binding the current Plugin API
 * actually uses; `node.boundVariables.fills` is the node-level form. The
 * transform reads both because real files contain both.
 */
export interface SnapshotPaint {
  type?: string;
  visible?: boolean;
  opacity?: number;
  color?: SnapshotRGBA;
  boundVariables?: { color?: SnapshotVariableRef };
  [extra: string]: unknown;
}

// ─── Node ─────────────────────────────────────────────────────────────────────

/**
 * One node of an extracted Figma tree.
 *
 * Every field is optional because the Plugin API only exposes a given property
 * on the node kinds that support it; the extraction script writes what it
 * finds and omits the rest. `id` is captured for extraction-time debugging
 * only — it is deliberately *never* carried into the scene graph, because
 * Figma node ids are session-scoped and a spec that embeds one stops being
 * reproducible.
 */
export interface SnapshotNode {
  id: string;
  name: string;
  /** Raw Plugin API node type: FRAME, TEXT, INSTANCE, VECTOR, … */
  type: string;

  // Visual
  visible?: boolean;
  opacity?: number;

  // Auto-layout
  layoutMode?: string;
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;

  // Geometry
  /** Absent when the four corners differ (Figma returns `figma.mixed`, which
   * does not survive JSON); the per-corner fields carry the truth then. */
  cornerRadius?: number;
  topLeftRadius?: number;
  topRightRadius?: number;
  bottomLeftRadius?: number;
  bottomRightRadius?: number;
  width?: number;
  height?: number;
  layoutSizingHorizontal?: string;
  layoutSizingVertical?: string;

  // Paint
  fills?: SnapshotPaint[];
  strokes?: SnapshotPaint[];
  strokeWeight?: number;
  strokeAlign?: string;
  clipsContent?: boolean;

  // TEXT
  characters?: string;
  /** Session-local style id. Present when the node uses a text style. */
  textStyleId?: string;
  /** Library key for the same style — the only form the registry indexes. */
  textStyleKey?: string;
  textAutoResize?: string;

  // INSTANCE
  componentKey?: string;
  mainComponentKey?: string;
  variantProperties?: Record<string, string>;

  /** Figma field name → the variable bound to it. See {@link SnapshotVariableRef}. */
  boundVariables?: Record<string, SnapshotVariableRef | SnapshotVariableRef[]>;

  children?: SnapshotNode[];
}

/**
 * Root of an extracted tree. Structurally a node — the root is just the
 * selected node — so that the walk has no special case at depth 0.
 */
export type SnapshotTree = SnapshotNode;

// ─── Extraction contract ──────────────────────────────────────────────────────

/**
 * The exact property list the extraction script must read off each node.
 *
 * Exported so a skill can *generate* the script from this array instead of
 * carrying a hand-maintained copy in prose. Adding a field here is the first
 * step of supporting it in `detokenize()`; a field absent from this list is,
 * by construction, a field import cannot see.
 *
 * `boundVariables` and `children` are structural and always captured.
 */
export const SNAPSHOT_FIELDS: readonly string[] = [
  "id",
  "name",
  "type",
  "visible",
  "opacity",
  "layoutMode",
  "itemSpacing",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "primaryAxisSizingMode",
  "counterAxisSizingMode",
  "primaryAxisAlignItems",
  "counterAxisAlignItems",
  "cornerRadius",
  "topLeftRadius",
  "topRightRadius",
  "bottomLeftRadius",
  "bottomRightRadius",
  "width",
  "height",
  "layoutSizingHorizontal",
  "layoutSizingVertical",
  "fills",
  "strokes",
  "strokeWeight",
  "strokeAlign",
  "clipsContent",
  "characters",
  "textStyleId",
  "textStyleKey",
  "textAutoResize",
  "componentKey",
  "mainComponentKey",
  "variantProperties",
  "boundVariables",
  "children",
];

/**
 * Fields the extraction script cannot read synchronously: each one needs an
 * `await` against the Figma API to turn a session-local id into a library key.
 * Listed separately because a generated script must emit `await` for these and
 * plain property reads for everything else.
 *
 * Skipping any of them does not fail extraction — it silently downgrades every
 * affected value to a FLAG, which is the failure mode this list exists to make
 * visible.
 */
export const SNAPSHOT_ASYNC_FIELDS: readonly {
  field: string;
  from: string;
  via: string;
}[] = [
  {
    field: "textStyleKey",
    from: "textStyleId",
    via: "(await figma.getStyleByIdAsync(id))?.key",
  },
  {
    field: "mainComponentKey",
    from: "mainComponent",
    via: "(await node.getMainComponentAsync())?.key",
  },
  {
    field: "boundVariables[*].key",
    from: "boundVariables[*].id",
    via: "(await figma.variables.getVariableByIdAsync(id))?.key",
  },
];
