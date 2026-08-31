export type Category = "actions" | "forms" | "data-display" | "feedback" | "navigation" | "layout" | "overlay" | "surface";
export type Status = "stable" | "beta" | "deprecated" | "experimental";
export interface ComponentEntry {
    key: string;
    name: string;
    category: Category;
    status: Status;
    variants: Array<{
        name: string;
        values: string[];
    }>;
    properties: Array<{
        name: string;
        type: string;
        default?: unknown;
    }>;
    description?: string;
}
export interface ComponentRegistry {
    version: number;
    generatedAt: string;
    components: ComponentEntry[];
}
export interface VariableEntry {
    key: string;
    name: string;
    resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
    valuesByMode: Record<string, unknown>;
    scopes?: string[];
}
export interface VariableRegistry {
    version: number;
    generatedAt: string;
    variables: VariableEntry[];
}
export interface TextStyleEntry {
    key: string;
    name: string;
    fontFamily: string;
    fontStyle: string;
    fontSize: number;
    lineHeight: number | string;
    letterSpacing?: number;
}
export interface TextStyleRegistry {
    version: number;
    generatedAt: string;
    styles: TextStyleEntry[];
}
export declare function readComponentRegistry(file: string): Promise<ComponentRegistry>;
export declare function readVariableRegistry(file: string): Promise<VariableRegistry>;
export declare function readTextStyleRegistry(file: string): Promise<TextStyleRegistry>;
export declare function writeRegistry(file: string, data: unknown): Promise<void>;
/**
 * A component created by Bridge rather than discovered in Figma.
 *
 * `properties` uses the **string-encoded** shape (`VARIANT(a,b,c)`, `"TEXT"`,
 * `"BOOLEAN"`, `"INSTANCE_SWAP"`) rather than the array shape declared on
 * {@link ComponentEntry}. That is deliberate: `lib/compiler/registry.ts` drops
 * array-shaped `properties` at read time, which silently disables variant
 * validation. The encoded record is the only shape the compiler actually
 * consumes.
 *
 * `source: "local"` marks the entry as not-yet-published, so the cron can
 * preserve it instead of overwriting it with a REST result that cannot
 * possibly contain it.
 */
export interface LocalComponentEntry {
    key: string;
    name: string;
    type: "COMPONENT" | "COMPONENT_SET";
    category?: string;
    properties: Record<string, string>;
    variantCount?: number;
    description?: string;
    source: "local";
    registeredAt: string;
}
/** Encode a variant axis the way the compiler's variant validator reads it. */
export declare function encodeVariantAxis(values: readonly string[]): string;
/**
 * Insert or replace a component in `components.json`, matching on `key` first
 * and on `name` second.
 *
 * The name fallback matters because a component re-created in Figma gets a new
 * key while keeping its name; without it the registry would accumulate a stale
 * duplicate that `resolve()` could pick over the live one.
 *
 * Reads and rewrites the whole file — there is no partial-write path, and the
 * registries are small enough that a full rewrite is the simpler contract.
 */
export declare function upsertComponentEntry(file: string, entry: LocalComponentEntry): Promise<{
    action: "inserted" | "replaced";
    total: number;
}>;
//# sourceMappingURL=registry-io.d.ts.map