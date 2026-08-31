import type { ComponentRegistry, VariableRegistry, TextStyleRegistry } from "../kb/registry-io.js";
export interface FigmaExtractOptions {
    fileKey: string;
    token: string;
    fetchImpl?: typeof fetch;
}
export interface FigmaExtractResult {
    variables: VariableRegistry;
    components: ComponentRegistry;
    textStyles: TextStyleRegistry;
}
/** Sentinel thrown when the variables endpoint is not available for the
 * token's plan tier. The Figma `/variables/local` REST endpoint is
 * Enterprise-only — non-Enterprise tokens get a 403. Callers should treat
 * this as "variables unavailable" rather than a hard error. */
export declare class VariablesEndpointUnavailableError extends Error {
    readonly status: number;
    constructor(status: number);
}
export declare function extractVariablesFromFigma(opts: FigmaExtractOptions): Promise<VariableRegistry>;
export declare function extractComponentsFromFigma(opts: FigmaExtractOptions): Promise<ComponentRegistry>;
export declare function extractTextStylesFromFigma(opts: FigmaExtractOptions): Promise<TextStyleRegistry>;
export declare function extractFromFigma(opts: FigmaExtractOptions): Promise<FigmaExtractResult>;
//# sourceMappingURL=figma-rest.d.ts.map