"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setGitHubSecret = setGitHubSecret;
exports.maskToken = maskToken;
exports.validateFigmaToken = validateFigmaToken;
exports.probeVariablesEndpoint = probeVariablesEndpoint;
// lib/cli/token-handling.ts
const node_child_process_1 = require("node:child_process");
/**
 * Send a secret to GitHub via `gh secret set`, piping the value through stdin.
 * The value NEVER appears in argv (not visible via `ps aux`).
 */
async function setGitHubSecret(opts) {
    const spawnFn = opts.spawnImpl ?? node_child_process_1.spawn;
    const proc = spawnFn("gh", ["secret", "set", opts.name, "--repo", opts.repo], {
        stdio: ["pipe", "inherit", "inherit"],
    });
    proc.stdin.write(opts.value);
    proc.stdin.end();
    return new Promise((resolve, reject) => {
        proc.on("exit", (code) => {
            if (code === 0)
                resolve();
            else
                reject(new Error(`gh secret set exited with code ${code}`));
        });
    });
}
/**
 * Safely represent a token for logging: figd_***<last4>.
 * Never logs the full token.
 */
function maskToken(token) {
    if (!token)
        return "(empty)";
    if (token.length < 12)
        return "***";
    return `figd_***${token.slice(-4)}`;
}
/**
 * Validate a Figma token against the /v1/me endpoint. Never logs the token.
 * Returns true on 2xx, false on 4xx (invalid/expired).
 */
async function validateFigmaToken(token, fetchImpl = fetch) {
    try {
        const res = await fetchImpl("https://api.figma.com/v1/me", {
            headers: { "X-Figma-Token": token },
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
/**
 * Test if the token can access the /variables/local endpoint for a given file.
 * Returns "ok" (200), "forbidden" (403 — non-Enterprise plan), or "error" (other).
 */
async function probeVariablesEndpoint(token, fileKey, fetchImpl = fetch) {
    try {
        const res = await fetchImpl(`https://api.figma.com/v1/files/${fileKey}/variables/local`, {
            headers: { "X-Figma-Token": token },
        });
        if (res.ok)
            return "ok";
        if (res.status === 403)
            return "forbidden";
        return "error";
    }
    catch {
        return "error";
    }
}
//# sourceMappingURL=token-handling.js.map