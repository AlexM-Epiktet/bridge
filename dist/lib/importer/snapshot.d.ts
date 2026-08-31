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
    boundVariables?: {
        color?: SnapshotVariableRef;
    };
    [extra: string]: unknown;
}
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
    visible?: boolean;
    opacity?: number;
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
    fills?: SnapshotPaint[];
    strokes?: SnapshotPaint[];
    strokeWeight?: number;
    strokeAlign?: string;
    clipsContent?: boolean;
    characters?: string;
    /** Session-local style id. Present when the node uses a text style. */
    textStyleId?: string;
    /** Library key for the same style — the only form the registry indexes. */
    textStyleKey?: string;
    textAutoResize?: string;
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
export declare const SNAPSHOT_FIELDS: readonly string[];
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
export declare const SNAPSHOT_ASYNC_FIELDS: readonly {
    field: string;
    from: string;
    via: string;
}[];
//# sourceMappingURL=snapshot.d.ts.map