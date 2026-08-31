import { type ImportFlag } from "../importer/detokenize.js";
export interface ImportCliOpts {
    /** Path to the extracted node-tree JSON. */
    treePath: string;
    /** Knowledge-base root (the directory containing `knowledge-base/`). */
    kbPath: string;
    /** Where to write the scene graph. Omitted means "report only". */
    outPath?: string;
    /** Overrides `metadata.name`, which otherwise takes the root node's name. */
    name?: string;
}
export interface ImportCliResult {
    sceneGraph: unknown;
    flags: ImportFlag[];
    exitCode: number;
}
/**
 * Read a snapshot, convert it, optionally write the scene graph, and print the
 * FLAG report.
 *
 * Returns the exit code instead of calling `process.exit` so the command stays
 * callable from tests and from other commands.
 */
export declare function importCommand(opts: ImportCliOpts): Promise<ImportCliResult>;
//# sourceMappingURL=import.d.ts.map