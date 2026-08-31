export interface VariableEntry {
    name: string;
    key: string;
    collection: string;
}
export interface ComponentEntry {
    name: string;
    key: string;
    type: string;
    properties: Record<string, unknown>;
    variants?: Array<{
        name: string;
        values: string[];
    }>;
}
export interface TextStyleEntry {
    name: string;
    key: string;
}
export interface AssetEntry {
    name: string;
    key: string;
    type?: string;
}
export interface VariableIndex {
    byName: Map<string, VariableEntry>;
    bySegment: Map<string, VariableEntry[]>;
}
export interface ComponentIndex {
    byName: Map<string, ComponentEntry>;
}
export interface TextStyleIndex {
    byName: Map<string, TextStyleEntry>;
    bySegment: Map<string, TextStyleEntry[]>;
}
export interface AssetIndex {
    byName: Map<string, AssetEntry>;
}
export interface Registry {
    variables: VariableIndex;
    components: ComponentIndex;
    textStyles: TextStyleIndex;
    icons: AssetIndex;
    logos: AssetIndex;
    allVariableNames: string[];
    allComponentNames: string[];
    allStyleNames: string[];
}
/**
 * Load all KB registry files and return a fully-indexed Registry object.
 */
export declare function loadRegistry(kbPath: string): Registry;
//# sourceMappingURL=registry.d.ts.map