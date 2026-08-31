import type { StyleStrategy } from "../codegen-web/utility-map.js";
import type { GeneratedFile } from "../codegen-web/angular.js";
export interface CodeOptions {
    /** Path to a scene-graph JSON file. */
    inputPath: string;
    kbPath: string;
    /** Output directory. When omitted the files are returned but not written. */
    outDir?: string;
    /** Component name; defaults to the scene's metadata name. */
    name?: string;
    target?: "angular";
    strategy?: StyleStrategy;
    docLanguage?: "en" | "fr";
    selectorPrefix?: string;
    classPrefix?: string;
    /** Base class every generated component extends. `""` disables it. */
    baseClass?: string;
    baseClassImport?: string;
    emitStories?: boolean;
}
export interface CodeResult {
    files: GeneratedFile[];
    flags: Array<{
        nodePath: string;
        role: string;
        token: string;
        reason: string;
    }>;
    notes: string[];
    errors: string[];
    exitCode: number;
}
export declare function codeCommand(opts: CodeOptions): Promise<CodeResult>;
/** Human-readable report for the CLI. */
export declare function formatCodeResult(result: CodeResult, outDir?: string): string;
//# sourceMappingURL=code.d.ts.map