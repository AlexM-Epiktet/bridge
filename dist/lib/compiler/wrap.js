"use strict";
// ---------------------------------------------------------------------------
// Transport wrappers — produce executable script strings from generated code
// ---------------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapConsole = wrapConsole;
exports.wrapOfficial = wrapOfficial;
exports.wrapChunk = wrapChunk;
const helpers_js_1 = require("./helpers.js");
const errors_js_1 = require("./errors.js");
const MAX_OFFICIAL_SIZE = 20000;
const NOTIFY_RE = /figma\.notify\([^)]*\);?\n?/g;
// ---------------------------------------------------------------------------
// Console transport (figma_execute) — IIFE wrapper
// ---------------------------------------------------------------------------
/**
 * Wrap code for the console transport (figma_execute).
 */
function wrapConsole(code, fontCode) {
    const parts = ["return (async function() {"];
    if (fontCode) {
        parts.push(fontCode);
    }
    parts.push(helpers_js_1.HELPER_BLOCK);
    parts.push(code);
    parts.push("return { success: true, rootId: root.id };");
    parts.push("})();");
    return parts.join("\n");
}
// ---------------------------------------------------------------------------
// Official transport (use_figma) — top-level await, no IIFE
// ---------------------------------------------------------------------------
/**
 * Wrap code for the official transport (use_figma).
 * Strips figma.notify() calls and enforces the 20KB limit.
 */
function wrapOfficial(code, fontCode, fileKey, _description) {
    if (!fileKey) {
        throw new errors_js_1.CompilerError("WRAP_MISSING_FILEKEY");
    }
    const sanitized = code.replace(NOTIFY_RE, "");
    const parts = [];
    if (fontCode) {
        parts.push(fontCode);
    }
    parts.push(helpers_js_1.HELPER_BLOCK);
    parts.push(sanitized);
    parts.push("return { success: true, rootId: root.id };");
    const result = parts.join("\n");
    if (result.length > MAX_OFFICIAL_SIZE) {
        throw new errors_js_1.CompilerError("WRAP_CODE_TOO_LARGE", {
            message: "Generated code is " + result.length + " chars (limit: " + MAX_OFFICIAL_SIZE + ")",
        });
    }
    return result;
}
/**
 * Wrap a single chunk for execution.
 * For multi-chunk build chunks (non-preload), prepends globalThis destructuring.
 */
function wrapChunk(code, chunk, transport, fileKey) {
    // codegen already handles globalThis bridging in build chunks — no extra destructuring needed here
    if (transport === "official") {
        return wrapOfficial(code, "", fileKey ?? null, chunk.label);
    }
    return wrapConsole(code, "");
}
//# sourceMappingURL=wrap.js.map