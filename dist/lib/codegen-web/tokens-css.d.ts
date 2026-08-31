import type { TokenValueIndex } from "../kb/values.js";
export interface TokensCssOptions {
    /** Prefix for every custom property. Defaults to none. */
    prefix?: string;
    /** Emit text styles as utility classes. Defaults to true. */
    includeTextStyles?: boolean;
}
export interface TokensCssResult {
    css: string;
    /** Token name → CSS custom property name, for the scene emitter to reuse. */
    varNameByToken: Map<string, string>;
    warnings: string[];
}
/**
 * Turn a DS token name into a CSS custom-property name.
 * `color/bg/primary` → `--color-bg-primary`
 */
export declare function cssVarName(tokenName: string, prefix?: string): string;
/**
 * Emit the token stylesheet.
 */
export declare function emitTokensCss(index: TokenValueIndex, opts?: TokensCssOptions): TokensCssResult;
//# sourceMappingURL=tokens-css.d.ts.map