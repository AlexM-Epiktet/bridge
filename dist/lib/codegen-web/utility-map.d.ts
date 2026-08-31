import type { TokenRefIndex } from "./token-refs.js";
export type StyleRole = "bg" | "text" | "border" | "gap" | "p" | "pt" | "pr" | "pb" | "pl" | "rounded";
export type StyleStrategy = "tailwind-daisyui" | "css-vars";
export interface StyleFlag {
    nodePath: string;
    role: StyleRole;
    token: string;
    reason: string;
}
export interface StyleOutput {
    /** Utility class names (tailwind-daisyui strategy). */
    classes: string[];
    /** CSS declarations as [property, value] pairs (css-vars strategy). */
    declarations: Array<[string, string]>;
    flag?: StyleFlag;
}
export interface TokenStyler {
    strategy: StyleStrategy;
    styleFor(role: StyleRole, token: unknown, nodePath: string): StyleOutput;
}
export declare function createStyler(strategy: StyleStrategy, refs: TokenRefIndex): TokenStyler;
//# sourceMappingURL=utility-map.d.ts.map