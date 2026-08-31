export interface SetupOrchestratorOptions {
    dsName: string;
    figmaFileKey: string;
    kbPath?: string;
    figmaToken?: string;
    githubRepo?: string;
    cronCadence?: "daily" | "weekly";
    cronTime?: string;
}
export interface SetupResult {
    scaffolded: string[];
    tokenStored: boolean;
    tokenValid: boolean;
    variablesAvailable: boolean;
    detectedGitRemote: string | null;
    detectedFigmaKey: string | null;
}
/**
 * Pre-flight: auto-detect what we can from the repo state.
 */
export declare function runPreflight(): Promise<{
    gitRemote: string | null;
    figmaKey: string | null;
}>;
/**
 * Write the scaffolding files: docs.config.yaml, cron workflow, and required
 * directory structure for KB-only Bridge v6.
 */
export declare function scaffold(opts: SetupOrchestratorOptions): Promise<string[]>;
/**
 * Store the Figma token in GitHub Secrets. Uses stdin pipe (no argv leak).
 * Probe also executed if a file key is provided to advertise Enterprise vs Pro.
 */
export declare function storeTokenInGitHubSecret(opts: {
    token: string;
    repo: string;
    fileKey?: string;
}): Promise<{
    tokenValid: boolean;
    variablesAvailable: boolean;
}>;
//# sourceMappingURL=setup-orchestrator.d.ts.map