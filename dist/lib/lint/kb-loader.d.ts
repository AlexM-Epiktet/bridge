export interface VariableEntry {
    readonly key: string;
    readonly name: string;
    readonly resolvedType?: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
    readonly valuesByMode?: Record<string, unknown>;
    readonly status?: "active" | "deprecated";
}
export interface ComponentEntry {
    readonly key: string;
    readonly name: string;
    readonly status?: "stable" | "beta" | "deprecated" | "experimental";
}
export interface KBSnapshot {
    readonly variableByName: Map<string, VariableEntry>;
    readonly componentByName: Map<string, ComponentEntry>;
    readonly textStyleByName: Map<string, {
        key: string;
        name: string;
    }>;
}
/** Load the KB registries from <cwd>/<kbPath>. Returns null if no registries dir exists. */
export declare function loadKB(cwd: string, kbPath?: string): KBSnapshot | null;
/** Reset the cache. Used in tests; not exported beyond the test boundary. */
export declare function _resetKBCache(): void;
//# sourceMappingURL=kb-loader.d.ts.map