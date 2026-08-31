import { CompilerError } from "./errors.js";
import type { Registry } from "./registry.js";
import type { ImportBundle, ResolvedComponent, ResolvedNode, ResolvedSceneGraph, ResolvedToken, SceneGraph } from "./types.js";
/** Deep clone via JSON round-trip. */
export declare function deepClone<T>(obj: T): T;
type WalkCallback = (node: ResolvedNode, path: string, parentChildren: ResolvedNode[], index: number) => ResolvedNode[] | undefined;
/**
 * Recursively walk nodes. If callback returns an array, it replaces the
 * current node via splice; otherwise recursion proceeds into children,
 * template, and else branches.
 */
export declare function walkNodes(nodes: ResolvedNode[] | undefined, callback: WalkCallback, path: string): void;
interface ResolveTokenResult {
    resolved: ResolvedToken | null;
    error: CompilerError | null;
}
interface ResolveComponentResult {
    resolved: ResolvedComponent | null;
    error: CompilerError | null;
}
/**
 * Resolve a single $token reference against the registry.
 */
export declare function resolveTokenRef(ref: string, registry: Registry): ResolveTokenResult;
/**
 * Resolve a component name to a registry entry.
 */
export declare function resolveComponent(name: string, registry: Registry): ResolveComponentResult;
export interface ResolveResult {
    graph: ResolvedSceneGraph;
    errors: CompilerError[];
    warnings: CompilerError[];
    imports: ImportBundle;
}
/**
 * Stage 2 of the compilation pipeline.
 * Walks the validated scene graph and resolves all token references,
 * component references, REPEAT expansions, and CONDITIONAL evaluations.
 */
export declare function resolve(graph: SceneGraph, registry: Registry): ResolveResult;
export {};
//# sourceMappingURL=resolve.d.ts.map