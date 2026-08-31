import type { Registry } from "../compiler/registry.js";
import type { SceneGraph } from "../compiler/types.js";
import type { SnapshotTree } from "./snapshot.js";
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
    stats: {
        nodes: number;
        tokensResolved: number;
        flagged: number;
    };
}
/**
 * Which token namespace a scene-graph field belongs to. Fixed per field, so the
 * mapping is a lookup rather than a judgement about the value.
 */
export type TokenCategory = "color" | "spacing" | "radius" | "text" | "effect";
/**
 * Turn an extracted Figma tree into a scene graph, reporting every value that
 * is not backed by the design system.
 *
 * Never throws on unbound values — an import that refuses to produce output
 * teaches the user nothing. It produces the graph *and* the list of what is
 * wrong with it.
 */
export declare function detokenize(tree: SnapshotTree, registry: Registry, opts?: {
    name?: string;
}): ImportResult;
//# sourceMappingURL=detokenize.d.ts.map