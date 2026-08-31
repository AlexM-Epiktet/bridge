import { spawn as realSpawn } from "node:child_process";
export type SpawnImpl = typeof realSpawn;
export interface SetGitHubSecretOptions {
    name: string;
    value: string;
    repo: string;
    spawnImpl?: SpawnImpl;
}
/**
 * Send a secret to GitHub via `gh secret set`, piping the value through stdin.
 * The value NEVER appears in argv (not visible via `ps aux`).
 */
export declare function setGitHubSecret(opts: SetGitHubSecretOptions): Promise<void>;
/**
 * Safely represent a token for logging: figd_***<last4>.
 * Never logs the full token.
 */
export declare function maskToken(token: string): string;
/**
 * Validate a Figma token against the /v1/me endpoint. Never logs the token.
 * Returns true on 2xx, false on 4xx (invalid/expired).
 */
export declare function validateFigmaToken(token: string, fetchImpl?: typeof fetch): Promise<boolean>;
/**
 * Test if the token can access the /variables/local endpoint for a given file.
 * Returns "ok" (200), "forbidden" (403 — non-Enterprise plan), or "error" (other).
 */
export declare function probeVariablesEndpoint(token: string, fileKey: string, fetchImpl?: typeof fetch): Promise<"ok" | "forbidden" | "error">;
//# sourceMappingURL=token-handling.d.ts.map