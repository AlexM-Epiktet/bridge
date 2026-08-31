"use strict";
// ---------------------------------------------------------------------------
// ERROR CODES
// ---------------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompilerError = exports.ERROR_CODES = void 0;
exports.levenshtein = levenshtein;
exports.suggest = suggest;
exports.formatErrors = formatErrors;
exports.ERROR_CODES = {
    // Parse phase
    PARSE_INVALID_JSON: { severity: "error", message: "Input is not valid JSON" },
    PARSE_UNKNOWN_NODE_TYPE: { severity: "error", message: "Unknown node type" },
    PARSE_MISSING_FIELD: { severity: "error", message: "Required field is missing" },
    PARSE_RAW_VALUE_NOT_ALLOWED: {
        severity: "warning",
        message: "Raw value used where a token is expected",
    },
    // Resolve phase
    RESOLVE_TOKEN_NOT_FOUND: { severity: "error", message: "Token not found in registry" },
    RESOLVE_COMPONENT_NOT_FOUND: {
        severity: "error",
        message: "Component not found in registry",
    },
    RESOLVE_VARIANT_INVALID: { severity: "error", message: "Invalid variant combination" },
    RESOLVE_CLONE_REF_MISSING: {
        severity: "error",
        message: "Clone reference node not found",
    },
    RESOLVE_INVALID_KEY_FORMAT: {
        severity: "error",
        message: "Key format is invalid (expected 40-char hex or VariableID)",
    },
    // Validate phase
    VALIDATE_FILL_IN_AUTO_PARENT: {
        severity: "error",
        message: "FILL child inside AUTO-sized parent collapses to 0px",
    },
    VALIDATE_RAW_SHAPE_HAS_DS_MATCH: {
        severity: "warning",
        message: "Raw shape could be replaced by a DS component",
    },
    VALIDATE_ORPHAN_CLONE: {
        severity: "warning",
        message: "Clone target has no matching node in the spec",
    },
    VALIDATE_TEXT_NO_STYLE: {
        severity: "error",
        message: "Text node has no text style applied",
    },
    VALIDATE_INSTANCE_HAS_CHILDREN: {
        severity: "error",
        message: "Cannot add children to a component instance",
    },
    VALIDATE_FORM_NO_FILLED_STATE: {
        severity: "warning",
        message: "Form component has real values but no filled state variant",
    },
    VALIDATE_UNKNOWN_VARIANT: {
        severity: "warning",
        message: "Requested variant property/value is not in the component's registry metadata",
    },
    // Wrap phase
    WRAP_MISSING_FILEKEY: {
        severity: "error",
        message: "fileKey is required for official transport",
    },
    WRAP_CODE_TOO_LARGE: {
        severity: "error",
        message: "Generated code exceeds 20KB transport limit",
    },
};
class CompilerError extends Error {
    code;
    severity;
    node;
    path;
    suggestion;
    constructor(code, opts) {
        const def = exports.ERROR_CODES[code];
        const options = opts ?? {};
        const msg = options.message ?? def?.message ?? code;
        super(msg);
        this.name = "CompilerError";
        this.code = code;
        this.severity = options.severity ?? def?.severity ?? "error";
        this.message = msg;
        this.node = options.node ?? null;
        this.path = options.path ?? null;
        this.suggestion = options.suggestion ?? null;
    }
}
exports.CompilerError = CompilerError;
// ---------------------------------------------------------------------------
// Levenshtein distance
// ---------------------------------------------------------------------------
function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const prev = Array.from({ length: n + 1 }, (_, j) => j);
    const curr = new Array(n + 1);
    for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        }
        for (let k = 0; k <= n; k++) {
            prev[k] = curr[k];
        }
    }
    return m === 0 ? n : prev[n];
}
// ---------------------------------------------------------------------------
// Fuzzy suggest
// ---------------------------------------------------------------------------
/**
 * Returns up to maxResults closest matches where distance < query.length * 0.6
 */
function suggest(query, candidates, maxResults = 3) {
    const threshold = query.length * 0.6;
    const scored = [];
    for (const c of candidates) {
        const d = levenshtein(query, c);
        if (d < threshold) {
            scored.push({ value: c, distance: d });
        }
    }
    scored.sort((a, b) => a.distance - b.distance);
    return scored.slice(0, maxResults).map((s) => s.value);
}
/**
 * Formats an array of CompilerError-like objects into a human-readable string.
 */
function formatErrors(errors) {
    if (!errors || !errors.length)
        return "";
    const lines = [];
    for (const err of errors) {
        const prefix = err.severity === "error" ? "ERROR" : "WARN ";
        const location = [err.node, err.path].filter(Boolean).join(" @ ");
        const header = location
            ? prefix + " [" + err.code + "] " + err.message + " (" + location + ")"
            : prefix + " [" + err.code + "] " + err.message;
        lines.push(header);
        if (err.suggestion && err.suggestion.length) {
            lines.push("       Did you mean: " + err.suggestion.join(", ") + "?");
        }
    }
    return lines.join("\n");
}
//# sourceMappingURL=errors.js.map