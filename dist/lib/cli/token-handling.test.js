"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
(0, node_test_1.test)("setGitHubSecret uses stdin pipe, not argv", async () => {
    const { setGitHubSecret } = await import("./token-handling.js");
    let capturedArgs = [];
    let capturedStdin = "";
    const fakeSpawn = (_cmd, args, _opts) => {
        capturedArgs = args;
        const proc = {
            stdin: {
                write(data) {
                    capturedStdin += String(data);
                    return true;
                },
                end() {
                    /* finalize */
                },
            },
            on(event, cb) {
                if (event === "exit")
                    setTimeout(() => cb(0), 0);
                return proc;
            },
        };
        return proc;
    };
    await setGitHubSecret({
        name: "FIGMA_TOKEN",
        value: "figd_TESTSENTINEL_123",
        repo: "acme/ds",
        spawnImpl: fakeSpawn,
    });
    strict_1.default.ok(!capturedArgs.includes("figd_TESTSENTINEL_123"), "token must never appear in argv");
    strict_1.default.equal(capturedStdin, "figd_TESTSENTINEL_123", "token must arrive via stdin");
});
(0, node_test_1.test)("setGitHubSecret rejects on nonzero exit code", async () => {
    const { setGitHubSecret } = await import("./token-handling.js");
    const fakeSpawn = (_cmd, _args, _opts) => {
        const proc = {
            stdin: {
                write() {
                    return true;
                },
                end() { },
            },
            on(event, cb) {
                if (event === "exit")
                    setTimeout(() => cb(1), 0);
                return proc;
            },
        };
        return proc;
    };
    await strict_1.default.rejects(async () => {
        await setGitHubSecret({ name: "X", value: "v", repo: "r", spawnImpl: fakeSpawn });
    });
});
(0, node_test_1.test)("maskToken returns figd_***<last4>", async () => {
    const { maskToken } = await import("./token-handling.js");
    strict_1.default.equal(maskToken("figd_abcdefghijklmnop"), "figd_***mnop");
    strict_1.default.equal(maskToken(""), "(empty)");
    strict_1.default.equal(maskToken("short"), "***"); // too short to show tail
});
(0, node_test_1.test)("validateFigmaToken returns false on 401", async () => {
    const { validateFigmaToken } = await import("./token-handling.js");
    const fakeFetch = async () => ({ ok: false, status: 401 });
    const ok = await validateFigmaToken("figd_bad", fakeFetch);
    strict_1.default.equal(ok, false);
});
(0, node_test_1.test)("validateFigmaToken returns true on 200", async () => {
    const { validateFigmaToken } = await import("./token-handling.js");
    const fakeFetch = async () => ({
        ok: true,
        status: 200,
        async json() {
            return { email: "x" };
        },
    });
    const ok = await validateFigmaToken("figd_good", fakeFetch);
    strict_1.default.equal(ok, true);
});
//# sourceMappingURL=token-handling.test.js.map