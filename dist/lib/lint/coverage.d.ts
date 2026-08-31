import type { CoverageReport, RuleDef, LintDiagnostic } from "./types.js";
interface ComputeOpts {
    rules: Record<string, RuleDef>;
    diagnostics: readonly LintDiagnostic[];
}
export declare function computeCoverage(opts: ComputeOpts): CoverageReport;
export declare function renderCoverage(report: CoverageReport): string;
export {};
//# sourceMappingURL=coverage.d.ts.map