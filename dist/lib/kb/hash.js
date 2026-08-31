"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stableStringify = stableStringify;
exports.sha256 = sha256;
const node_crypto_1 = require("node:crypto");
function stableStringify(value) {
    if (value === null || typeof value !== "object")
        return JSON.stringify(value);
    if (Array.isArray(value))
        return "[" + value.map(stableStringify).join(",") + "]";
    const keys = Object.keys(value).sort();
    const body = keys
        .map((k) => JSON.stringify(k) + ":" + stableStringify(value[k]))
        .join(",");
    return "{" + body + "}";
}
function sha256(value) {
    return (0, node_crypto_1.createHash)("sha256").update(stableStringify(value)).digest("hex");
}
//# sourceMappingURL=hash.js.map