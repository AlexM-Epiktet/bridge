interface LintCliOpts {
    readonly configPath: string;
    readonly failSeverity: "warn" | "error" | "off";
    readonly coverage: boolean;
}
export declare function lintCommand(opts: LintCliOpts): Promise<number>;
export {};
//# sourceMappingURL=lint.d.ts.map