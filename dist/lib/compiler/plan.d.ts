import type { ResolvedNode, ResolvedSceneGraph, ImportBundle } from "./types.js";
export declare const MAX_CHUNK_SIZE = 12000;
export declare const MAX_IMPORTS = 30;
export declare const BUILD_TARGET = 3000;
export interface Chunk {
    index: number;
    label: string;
    imports: ImportBundle;
    nodes: ResolvedNode[];
    bridgeExports: string[];
    bridgeImports: string[];
}
export interface ExecutionPlan {
    chunks: Chunk[];
    totalImports: number;
    estimatedCodeSize: number;
}
export interface PlanOptions {
    transport?: string;
    maxChunkSize?: number;
}
/**
 * Plan how to split a resolved graph into executable chunks.
 */
export declare function plan(resolvedGraph: Pick<ResolvedSceneGraph, "nodes"> | null | undefined, imports: ImportBundle | null | undefined, options?: PlanOptions): ExecutionPlan;
//# sourceMappingURL=plan.d.ts.map