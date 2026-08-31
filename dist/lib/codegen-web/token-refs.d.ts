import type { TokenValueIndex } from "../kb/values.js";
export type TokenRefSource = "theme-lockfile" | "generated";
export interface TokenRef {
    /** Registry name of the token, e.g. `main/color/primary/primary`. */
    token: string;
    /** CSS custom property, e.g. `--color-primary`. */
    cssVar: string;
    /** Ready-to-use CSS reference, e.g. `var(--color-primary)`. */
    reference: string;
    source: TokenRefSource;
}
export interface UnboundToken {
    token: string;
    key?: string;
    reason: string;
}
export interface TokenRefIndex {
    byName: Map<string, TokenRef>;
    byKey: Map<string, TokenRef>;
    unbound: UnboundToken[];
    /** True when at least one token resolves through Bridge-generated values,
     * i.e. a `tokens.css` actually needs to be written. */
    needsGeneratedStylesheet: boolean;
    /** Stylesheet the lockfile mirrors, when one is declared. */
    themeCssFile: string | null;
}
export interface TokenRefOptions {
    /** Prefix applied to generated custom properties. */
    prefix?: string;
}
/**
 * Build the token → CSS reference index from a loaded KB.
 *
 * Lockfile bindings win over generated ones: when a stylesheet already exists
 * and is verified in CI, emitting a competing definition of the same property
 * would put the two out of sync on the next theme change.
 */
export declare function buildTokenRefs(values: TokenValueIndex, opts?: TokenRefOptions): TokenRefIndex;
/**
 * Look up a resolved token (as carried on a resolved scene-graph node) and
 * return its CSS reference, or null when the KB cannot prove a value.
 *
 * Accepts either a `ResolvedToken`-shaped object (`{key, name}`) or a bare
 * token name.
 */
export declare function refFor(index: TokenRefIndex, token: unknown): TokenRef | null;
//# sourceMappingURL=token-refs.d.ts.map