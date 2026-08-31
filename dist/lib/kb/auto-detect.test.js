"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_path_1 = __importDefault(require("node:path"));
const auto_detect_js_1 = require("./auto-detect.js");
const FIX = node_path_1.default.resolve("test/fixtures/readme");
(0, node_test_1.test)("detectFigmaFileKey parses URL from README code block", async () => {
    const result = await (0, auto_detect_js_1.detectFigmaFileKey)({ readmePath: node_path_1.default.join(FIX, "with-figma-url.md") });
    strict_1.default.equal(result, "abc123FILE_KEY_SAMPLE");
});
(0, node_test_1.test)("detectFigmaFileKey returns null when README has no URL", async () => {
    const result = await (0, auto_detect_js_1.detectFigmaFileKey)({ readmePath: node_path_1.default.join(FIX, "without-figma-url.md") });
    strict_1.default.equal(result, null);
});
(0, node_test_1.test)("detectFigmaFileKey falls back to package.json figma field", async () => {
    const result = await (0, auto_detect_js_1.detectFigmaFileKey)({
        readmePath: "does-not-exist",
        packageJsonPath: node_path_1.default.join(FIX, "with-package-json-figma.json"),
    });
    strict_1.default.equal(result, "xyz789OTHER_KEY");
});
(0, node_test_1.test)("detectGitRemote parses origin URL from git config", async () => {
    const mockConfig = `[remote "origin"]
\turl = git@github.com:acme/design-system.git
\tfetch = +refs/heads/*:refs/remotes/origin/*`;
    const result = await (0, auto_detect_js_1.detectGitRemote)({ gitConfigContent: mockConfig });
    strict_1.default.equal(result, "acme/design-system");
});
(0, node_test_1.test)("detectGitRemote handles https remote", async () => {
    const mockConfig = `[remote "origin"]
\turl = https://github.com/acme/design-system.git`;
    const result = await (0, auto_detect_js_1.detectGitRemote)({ gitConfigContent: mockConfig });
    strict_1.default.equal(result, "acme/design-system");
});
(0, node_test_1.test)("detectGitRemote returns null when no remote found", async () => {
    const result = await (0, auto_detect_js_1.detectGitRemote)({
        gitConfigContent: "[core]\n\trepositoryformatversion = 0\n",
    });
    strict_1.default.equal(result, null);
});
//# sourceMappingURL=auto-detect.test.js.map