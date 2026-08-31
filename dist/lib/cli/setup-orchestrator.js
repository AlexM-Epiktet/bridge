"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPreflight = runPreflight;
exports.scaffold = scaffold;
exports.storeTokenInGitHubSecret = storeTokenInGitHubSecret;
// lib/cli/setup-orchestrator.ts
const promises_1 = require("node:fs/promises");
const auto_detect_js_1 = require("../kb/auto-detect.js");
const token_handling_js_1 = require("./token-handling.js");
const main_js_1 = require("./main.js");
/**
 * Pre-flight: auto-detect what we can from the repo state.
 */
async function runPreflight() {
    const gitRemote = await (0, auto_detect_js_1.detectGitRemote)();
    const figmaKey = await (0, auto_detect_js_1.detectFigmaFileKey)();
    return { gitRemote, figmaKey };
}
/**
 * Write the scaffolding files: docs.config.yaml, cron workflow, and required
 * directory structure for KB-only Bridge v6.
 */
async function scaffold(opts) {
    const kbPath = opts.kbPath ?? "bridge-ds";
    const cadence = opts.cronCadence ?? "daily";
    const time = opts.cronTime ?? "06:00";
    const created = [];
    for (const dir of [
        `${kbPath}/knowledge-base/registries`,
        `${kbPath}/knowledge-base/recipes`,
        ".bridge",
        ".github/workflows",
    ]) {
        await (0, promises_1.mkdir)(dir, { recursive: true });
        created.push(dir + "/");
    }
    const configYaml = `dsName: "${opts.dsName}"\nfigmaFileKey: "${opts.figmaFileKey}"\nkbPath: "${kbPath}"\ncron:\n  cadence: "${cadence}"\n  time: "${time}"\n`;
    await (0, promises_1.writeFile)("docs.config.yaml", configYaml, "utf8");
    created.push("docs.config.yaml");
    const cronYaml = `name: Bridge KB — Daily Sync

on:
  schedule:
    - cron: "0 6 * * *"
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: Run Bridge KB sync
        env:
          FIGMA_TOKEN: \${{ secrets.FIGMA_TOKEN }}
        run: npx -y @kinougarde/bridge-ds@${main_js_1.VERSION} cron --config docs.config.yaml
      - name: Open PR if changes
        uses: peter-evans/create-pull-request@v6
        with:
          commit-message: "chore: Bridge KB daily sync"
          branch: bridge-kb/cron-sync
          title: "Bridge KB sync"
          body-path: .bridge/last-sync-report.md
          delete-branch: true
          labels: bridge-kb, automated
`;
    await (0, promises_1.writeFile)(".github/workflows/bridge-kb-cron.yml", cronYaml, "utf8");
    created.push(".github/workflows/bridge-kb-cron.yml");
    return created;
}
/**
 * Store the Figma token in GitHub Secrets. Uses stdin pipe (no argv leak).
 * Probe also executed if a file key is provided to advertise Enterprise vs Pro.
 */
async function storeTokenInGitHubSecret(opts) {
    const tokenValid = await (0, token_handling_js_1.validateFigmaToken)(opts.token);
    if (!tokenValid) {
        throw new Error(`Figma token ${(0, token_handling_js_1.maskToken)(opts.token)} is invalid. Please regenerate on figma.com/settings/tokens.`);
    }
    let variablesAvailable = false;
    if (opts.fileKey) {
        try {
            const probeRes = await (0, token_handling_js_1.probeVariablesEndpoint)(opts.token, opts.fileKey);
            variablesAvailable = probeRes === "ok";
        }
        catch {
            // probe failure is non-fatal
        }
    }
    await (0, token_handling_js_1.setGitHubSecret)({
        name: "FIGMA_TOKEN",
        value: opts.token,
        repo: opts.repo,
    });
    return { tokenValid, variablesAvailable };
}
//# sourceMappingURL=setup-orchestrator.js.map