import type { RulesetFunction } from "@stoplight/spectral-core";
/**
 * Context object threaded into every Bridge built-in custom function factory.
 *
 * `cwd` is the consumer repo cwd (where `bridge-ds lint` was invoked, or the
 * compiler's working directory). It is used to resolve relative paths in
 * functionOptions and to load the consumer's KB.
 */
export interface BridgeBuiltinContext {
    /** Consumer's repo cwd. Used to resolve relative paths (kbPath, fixture loads). */
    readonly cwd: string;
    /** Relative path to consumer KB, default "bridge-ds/knowledge-base". */
    readonly kbPath?: string;
}
/**
 * Build the full map of Bridge built-in custom functions for a given context.
 * Called once per `runRulesAgainstDocument` invocation.
 */
export declare function buildBridgeBuiltinFunctions(ctx: BridgeBuiltinContext): Record<string, RulesetFunction<unknown, unknown>>;
//# sourceMappingURL=builtin-functions.d.ts.map