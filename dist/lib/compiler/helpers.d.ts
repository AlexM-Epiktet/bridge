export declare const HELPER_BLOCK: string;
export interface FontRef {
    family: string;
    style: string;
}
/**
 * Returns a JavaScript code string that loads the given fonts via
 * figma.loadFontAsync.
 */
export declare function fontLoader(fonts: readonly FontRef[] | null | undefined): string;
//# sourceMappingURL=helpers.d.ts.map