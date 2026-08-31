import { CompilerError } from "./errors.js";
import type { NodeType, SceneGraph, SceneNode } from "./types.js";
export declare const NODE_TYPES: readonly NodeType[];
export interface SchemaValidationResult {
    valid: boolean;
    errors: CompilerError[];
    graph: SceneGraph | null;
}
/**
 * Validate a complete scene graph JSON document.
 */
export declare function validateSceneGraph(json: unknown): SchemaValidationResult;
export type { SceneNode, SceneGraph };
//# sourceMappingURL=schema.d.ts.map