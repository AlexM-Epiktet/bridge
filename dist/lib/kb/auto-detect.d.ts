/**
 * Detect a Figma file key by scanning, in order:
 * 1. README.md (provided path or "./README.md")
 * 2. CLAUDE.md (provided path or "./CLAUDE.md")
 * 3. package.json "figma.url" field
 * Returns the file key, or null if none found.
 */
export declare function detectFigmaFileKey(opts?: {
    readmePath?: string;
    claudeMdPath?: string;
    packageJsonPath?: string;
}): Promise<string | null>;
/**
 * Detect the GitHub remote repo in "owner/name" form from .git/config.
 * Accepts either an explicit content string (for testing) or a path.
 */
export declare function detectGitRemote(opts?: {
    gitConfigContent?: string;
    gitDir?: string;
}): Promise<string | null>;
//# sourceMappingURL=auto-detect.d.ts.map