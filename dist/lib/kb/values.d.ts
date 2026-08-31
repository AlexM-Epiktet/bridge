export type TokenValue = {
    kind: "color";
    hex: string;
    alpha: number;
} | {
    kind: "number";
    value: number;
} | {
    kind: "string";
    value: string;
} | {
    kind: "boolean";
    value: boolean;
};
export interface TokenVariable {
    key: string;
    id?: string;
    name: string;
    resolvedType: string;
    /** Figma variable scopes (GAP, CORNER_RADIUS, OPACITY, …). The authoritative
     * signal for whether a FLOAT is a length or a bare ratio. */
    scopes?: string[];
    /** Mode label → resolved value. Modes whose value could not be resolved are absent. */
    valuesByMode: Record<string, TokenValue>;
}
export interface TokenTextStyle {
    key: string;
    name: string;
    fontFamily: string;
    fontStyle: string;
    fontSize: number;
    lineHeight: number | string;
    letterSpacing?: number;
    /** False when the extractor could not read real metrics from Figma. */
    metricsResolved: boolean;
}
/**
 * One entry of the theme lockfile: a Figma variable bound to a CSS custom
 * property that already exists in the consumer's stylesheet.
 *
 * This is the authoritative binding when present. Figma's `/variables/local`
 * REST endpoint is Enterprise-only, so on most plans `variables.json` carries
 * keys with no values at all — the lockfile is then the *only* path from a
 * `$token` to something a browser can read.
 */
export interface ThemeBinding {
    cssVar: string;
    figmaName?: string;
    figmaKey?: string;
    type?: string;
    cssValue: string;
}
export interface TokenValueIndex {
    variables: TokenVariable[];
    variableByName: Map<string, TokenVariable>;
    variableByKey: Map<string, TokenVariable>;
    textStyles: TokenTextStyle[];
    textStyleByName: Map<string, TokenTextStyle>;
    textStyleByKey: Map<string, TokenTextStyle>;
    /** Theme-lockfile bindings, indexed by Figma variable name and by key. */
    themeByName: Map<string, ThemeBinding>;
    themeByKey: Map<string, ThemeBinding>;
    /** Stylesheet the lockfile mirrors, when it declares one. */
    themeCssFile: string | null;
    /** Mode labels in first-seen order, with the default mode first. */
    modes: string[];
    defaultMode: string;
    warnings: string[];
}
/**
 * Convert a Figma RGBA record (floats 0–1) to a CSS hex string plus a
 * separate alpha. Alpha is kept out of the hex so the emitter can choose
 * between `#rrggbb` and `rgb(... / alpha)` per context.
 */
export declare function rgbaToHex(rgba: {
    r: number;
    g: number;
    b: number;
    a?: number;
}): {
    hex: string;
    alpha: number;
};
/**
 * Load token *values* from the knowledge base at `kbPath`.
 *
 * Mirrors the layout used by `loadRegistry()`: `<kbPath>/knowledge-base/registries`.
 */
export declare function loadTokenValues(kbPath: string): TokenValueIndex;
//# sourceMappingURL=values.d.ts.map