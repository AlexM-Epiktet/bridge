"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SNAPSHOT_ASYNC_FIELDS = exports.SNAPSHOT_FIELDS = void 0;
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
exports.SNAPSHOT_FIELDS = [
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
exports.SNAPSHOT_ASYNC_FIELDS = [
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
//# sourceMappingURL=snapshot.js.map