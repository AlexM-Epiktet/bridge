import type { LintConfig } from "./types.js";
/**
 * Load a lint config file. Returns null if the file does not exist
 * (engine is then dormant — opt-in via presence of config).
 *
 * Resolves `extends` chains recursively. Later configs override earlier.
 */
export declare function loadConfig(configPath: string): Promise<LintConfig | null>;
//# sourceMappingURL=loader.d.ts.map