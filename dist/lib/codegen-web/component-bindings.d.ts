export interface AngularBinding {
    /** Angular element selector, e.g. `am-input-field`. Null when none exists. */
    selector: string | null;
    /** Import path alias, e.g. `@amelis/foundation/web-ui`. */
    lib: string | null;
    /** Source file, relative to the consumer workspace root. */
    sourcePath: string | null;
    kind: string;
    note?: string;
}
export interface BindingIndex {
    /** Lower-cased Figma component name → binding. */
    byName: Map<string, AngularBinding>;
    byKey: Map<string, AngularBinding>;
    /** Bindings that exist but cannot produce an element, with the reason. */
    unusable: Array<{
        name: string;
        kind: string;
        reason: string;
    }>;
}
/**
 * Load the Figma → Angular bindings from `<kbPath>/knowledge-base/registries/components.json`.
 *
 * A missing or malformed file yields an empty index rather than an error:
 * bindings are an enrichment, and a KB without them should still generate
 * markup (falling back to primitives and flags).
 */
export declare function loadComponentBindings(kbPath: string): BindingIndex;
/** Look up a binding by resolved component token or by raw name. */
export declare function bindingFor(index: BindingIndex, component: unknown): AngularBinding | null;
//# sourceMappingURL=component-bindings.d.ts.map