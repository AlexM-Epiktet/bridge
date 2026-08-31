"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const token_handling_js_1 = require("../../lib/cli/token-handling.js");
const SENTINEL = "figd_TESTSENTINEL_0000000000000";
(0, node_test_1.test)("token never appears in process.env after set operation", async () => {
    const envBefore = Object.values(process.env).join("");
    strict_1.default.ok(!envBefore.includes(SENTINEL), "sentinel must not be pre-seeded in env");
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
                    setTimeout(() => cb(0), 0);
                return proc;
            },
        };
        return proc;
    };
    await (0, token_handling_js_1.setGitHubSecret)({
        name: "FIGMA_TOKEN",
        value: SENTINEL,
        repo: "acme/test",
        spawnImpl: fakeSpawn,
    });
    const envAfter = Object.values(process.env).join("");
    strict_1.default.ok(!envAfter.includes(SENTINEL), "sentinel leaked into process.env");
});
(0, node_test_1.test)("maskToken never returns full token", () => {
    const masked = (0, token_handling_js_1.maskToken)(SENTINEL);
    strict_1.default.ok(!masked.includes("TESTSENTINEL"), "masked output exposed the middle of the token");
    strict_1.default.ok(masked.startsWith("figd_***"), "masked output must start with figd_***");
});
(0, node_test_1.test)("validateFigmaToken does not log the value on failure", async () => {
    const logs = [];
    const origError = console.error;
    console.error = (...args) => {
        logs.push(args.map(String).join(" "));
    };
    try {
        const fakeFetch = async () => ({ ok: false, status: 401 });
        await (0, token_handling_js_1.validateFigmaToken)(SENTINEL, fakeFetch);
    }
    finally {
        console.error = origError;
    }
    const joined = logs.join("\n");
    strict_1.default.ok(!joined.includes(SENTINEL), "token leaked into console.error");
});
//# sourceMappingURL=token-leak.test.js.map