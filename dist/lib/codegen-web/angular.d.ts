import type { ResolvedSceneGraph } from "../compiler/types.js";
import type { TokenRefIndex } from "./token-refs.js";
import type { StyleFlag, StyleStrategy } from "./utility-map.js";
import type { BindingIndex } from "./component-bindings.js";
export interface AngularEmitOptions {
    /** Component name in any case; normalised to kebab-case for files. */
    name: string;
    strategy?: StyleStrategy;
    /** Element selector prefix. Defaults to `am`. */
    selectorPrefix?: string;
    /** Class name prefix. Defaults to `Am`. */
    classPrefix?: string;
    /** Base class every component extends, or null for none. */
    baseClass?: {
        name: string;
        importPath: string;
    } | null;
    /** Language for generated doc comments. Application code follows the
     * consumer's conventions, which are not always English. */
    docLanguage?: "en" | "fr";
    /** Indentation unit. Defaults to a tab. */
    indent?: string;
    /** Emit a Storybook CSF3 story alongside the component. */
    emitStories?: boolean;
    /** Bindings from the KB; without them every INSTANCE falls back or flags. */
    bindings?: BindingIndex;
    /** Name of the source spec, recorded in the generated doc comment. */
    specName?: string;
}
export interface GeneratedFile {
    path: string;
    content: string;
}
export interface AngularEmitResult {
    files: GeneratedFile[];
    flags: StyleFlag[];
    /** Findings that are not token violations but need a human decision. */
    notes: string[];
}
export declare function toKebabCase(input: string): string;
export declare function toPascalCase(input: string): string;
export interface ClassPlan {
    /** Every class this node takes in at least one variant but not all of them. */
    variantClasses: string[];
    /** Name of the computed signal that supplies them at runtime. */
    signal: string;
}
/**
 * Emit an Angular component from a resolved scene graph.
 */
export declare function emitAngularComponent(graph: ResolvedSceneGraph, refs: TokenRefIndex, opts: AngularEmitOptions): AngularEmitResult;
//# sourceMappingURL=angular.d.ts.map