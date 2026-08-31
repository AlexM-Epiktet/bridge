import type { RuleDef, LintResult } from "./types.js";
import type { LoadedFunction } from "./load-custom-functions.js";
interface RunOptions {
    readonly source: string;
    readonly customFunctions?: ReadonlyArray<LoadedFunction>;
    /**
     * Consumer's repo cwd. Threaded into Bridge built-in custom functions so
     * filesystem-bound checks (snapshot-exists, future KB-based functions)
     * resolve paths relative to the right repo. Defaults to `process.cwd()`.
     */
    readonly cwd?: string;
    /** Relative path to consumer KB, default "bridge-ds/knowledge-base". */
    readonly kbPath?: string;
}
type RuleInput = Omit<RuleDef, "id"> & {
    readonly id?: string;
};
export declare function runRulesAgainstDocument(ruleset: {
    rules: Record<string, RuleInput>;
}, document: unknown, opts: RunOptions): Promise<LintResult>;
export {};
//# sourceMappingURL=engine.d.ts.map