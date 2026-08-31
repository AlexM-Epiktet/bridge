import { CompilerError } from "./errors.js";
import type { Registry } from "./registry.js";
import type { ResolvedSceneGraph } from "./types.js";
export interface ValidationResult {
    valid: boolean;
    errors: CompilerError[];
    warnings: CompilerError[];
}
/**
 * Validate a resolved scene graph for structural correctness.
 */
export declare function validate(graph: ResolvedSceneGraph, registry: Registry | null): ValidationResult;
//# sourceMappingURL=validate.d.ts.map