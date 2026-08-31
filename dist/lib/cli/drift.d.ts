import { type RegistryDiff } from "../kb/baseline.js";
export interface DriftOptions {
    /** KB root — registries live at `<kbPath>/knowledge-base/registries`. */
    kbPath: string;
    /** docs.config.yaml, for the Figma file key(s). Defaults to the repo root one. */
    configPath?: string;
    /** Write the new baseline after reporting. Never touches registry files. */
    updateBaseline?: boolean;
    /** Injectable fetch, for tests. */
    fetchImpl?: typeof fetch;
}
/** Which side of the comparison an entry describes. `upstream` = live Figma
 * vs baseline; `local` = the registry file on disk vs baseline. Both matter:
 * upstream drift means Figma moved, local drift means someone hand-edited. */
export type DriftSource = "upstream" | "local";
export interface RegistryDriftEntry {
    registry: string;
    source: DriftSource;
    diff: RegistryDiff;
    note?: string;
}
export interface DriftReport {
    registries: RegistryDriftEntry[];
    recommendations: string[];
    /** 0 = no drift, 1 = drift found. Non-fatal — the caller decides. */
    exitCode: number;
}
export declare function driftCommand(opts: DriftOptions): Promise<DriftReport>;
/** Plain-text report. No colour codes: this output is piped into skill
 * transcripts and CI logs as often as it is read in a terminal. */
export declare function formatDriftReport(report: DriftReport): string;
//# sourceMappingURL=drift.d.ts.map