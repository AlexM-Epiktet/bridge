export type ErrorSeverity = "error" | "warning";
export interface ErrorCodeDefinition {
    severity: ErrorSeverity;
    message: string;
}
export declare const ERROR_CODES: {
    readonly PARSE_INVALID_JSON: {
        readonly severity: "error";
        readonly message: "Input is not valid JSON";
    };
    readonly PARSE_UNKNOWN_NODE_TYPE: {
        readonly severity: "error";
        readonly message: "Unknown node type";
    };
    readonly PARSE_MISSING_FIELD: {
        readonly severity: "error";
        readonly message: "Required field is missing";
    };
    readonly PARSE_RAW_VALUE_NOT_ALLOWED: {
        readonly severity: "warning";
        readonly message: "Raw value used where a token is expected";
    };
    readonly RESOLVE_TOKEN_NOT_FOUND: {
        readonly severity: "error";
        readonly message: "Token not found in registry";
    };
    readonly RESOLVE_COMPONENT_NOT_FOUND: {
        readonly severity: "error";
        readonly message: "Component not found in registry";
    };
    readonly RESOLVE_VARIANT_INVALID: {
        readonly severity: "error";
        readonly message: "Invalid variant combination";
    };
    readonly RESOLVE_CLONE_REF_MISSING: {
        readonly severity: "error";
        readonly message: "Clone reference node not found";
    };
    readonly RESOLVE_INVALID_KEY_FORMAT: {
        readonly severity: "error";
        readonly message: "Key format is invalid (expected 40-char hex or VariableID)";
    };
    readonly VALIDATE_FILL_IN_AUTO_PARENT: {
        readonly severity: "error";
        readonly message: "FILL child inside AUTO-sized parent collapses to 0px";
    };
    readonly VALIDATE_RAW_SHAPE_HAS_DS_MATCH: {
        readonly severity: "warning";
        readonly message: "Raw shape could be replaced by a DS component";
    };
    readonly VALIDATE_ORPHAN_CLONE: {
        readonly severity: "warning";
        readonly message: "Clone target has no matching node in the spec";
    };
    readonly VALIDATE_TEXT_NO_STYLE: {
        readonly severity: "error";
        readonly message: "Text node has no text style applied";
    };
    readonly VALIDATE_INSTANCE_HAS_CHILDREN: {
        readonly severity: "error";
        readonly message: "Cannot add children to a component instance";
    };
    readonly VALIDATE_FORM_NO_FILLED_STATE: {
        readonly severity: "warning";
        readonly message: "Form component has real values but no filled state variant";
    };
    readonly VALIDATE_UNKNOWN_VARIANT: {
        readonly severity: "warning";
        readonly message: "Requested variant property/value is not in the component's registry metadata";
    };
    readonly WRAP_MISSING_FILEKEY: {
        readonly severity: "error";
        readonly message: "fileKey is required for official transport";
    };
    readonly WRAP_CODE_TOO_LARGE: {
        readonly severity: "error";
        readonly message: "Generated code exceeds 20KB transport limit";
    };
};
export type ErrorCode = keyof typeof ERROR_CODES;
export interface CompilerErrorOptions {
    message?: string;
    severity?: ErrorSeverity;
    node?: string | null;
    path?: string | null;
    suggestion?: readonly string[] | null;
}
export declare class CompilerError extends Error {
    readonly code: string;
    severity: ErrorSeverity;
    node: string | null;
    path: string | null;
    suggestion: readonly string[] | null;
    constructor(code: ErrorCode | string, opts?: CompilerErrorOptions);
}
export declare function levenshtein(a: string, b: string): number;
/**
 * Returns up to maxResults closest matches where distance < query.length * 0.6
 */
export declare function suggest(query: string, candidates: readonly string[], maxResults?: number): string[];
export interface FormattableError {
    code: string;
    message: string;
    severity?: ErrorSeverity;
    node?: string | null;
    path?: string | null;
    suggestion?: readonly string[] | null;
}
/**
 * Formats an array of CompilerError-like objects into a human-readable string.
 */
export declare function formatErrors(errors: readonly FormattableError[] | null | undefined): string;
//# sourceMappingURL=errors.d.ts.map