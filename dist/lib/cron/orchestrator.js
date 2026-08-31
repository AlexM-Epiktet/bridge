"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeLocalComponents = mergeLocalComponents;
exports.runCron = runCron;
// lib/cron/orchestrator.ts
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const figma_rest_js_1 = require("../extractors/figma-rest.js");
const kb_config_js_1 = require("../config/kb-config.js");
/**
 * Merge a fresh REST extraction over the existing `components.json`, keeping
 * entries the extraction cannot possibly know about.
 *
 * Two classes of entry survive a refresh:
 *
 * - **`source: "local"`** — components Bridge created in the Figma file but
 *   which are not published as library components, so `/components` never
 *   returns them. Overwriting would erase a component the user just made.
 * - **entries carrying an `angular` binding** — the Figma↔code mapping is
 *   maintained by hand (or by a rebind pass) and has no REST counterpart. The
 *   REST entry wins for everything else, but the binding is grafted back on.
 *
 * A local entry whose key later shows up in the REST result is dropped in
 * favour of the published one: publication is the promotion path, and keeping
 * both would leave two entries resolving to the same component.
 */
async function mergeLocalComponents(file, fresh) {
    let previous = [];
    try {
        const raw = JSON.parse(await (0, promises_1.readFile)(file, "utf8"));
        if (Array.isArray(raw.components)) {
            previous = raw.components;
        }
    }
    catch {
        // No readable previous file — nothing to preserve.
    }
    const freshList = (fresh.components ?? []);
    const freshByKey = new Map();
    for (const c of freshList) {
        if (typeof c.key === "string")
            freshByKey.set(c.key, c);
    }
    let preserved = 0;
    // Graft hand-maintained bindings back onto the refreshed entries.
    for (const prev of previous) {
        if (!prev.angular || typeof prev.key !== "string")
            continue;
        const match = freshByKey.get(prev.key);
        if (match && match.angular === undefined) {
            match.angular = prev.angular;
            preserved++;
        }
    }
    // Carry over local components that publication has not yet promoted.
    const carried = previous.filter((c) => c.source === "local" && (typeof c.key !== "string" || !freshByKey.has(c.key)));
    preserved += carried.length;
    return {
        registry: { ...fresh, components: [...freshList, ...carried] },
        preserved,
    };
}
async function runCron(opts) {
    const raw = await (0, promises_1.readFile)(opts.configPath, "utf8");
    const cfg = (0, kb_config_js_1.parseKBConfig)(raw);
    const token = process.env.FIGMA_TOKEN;
    if (!token)
        throw new Error("FIGMA_TOKEN env var is required");
    const regDir = node_path_1.default.join(cfg.kbPath, "knowledge-base", "registries");
    await (0, promises_1.mkdir)(regDir, { recursive: true });
    const writes = [];
    const skips = [];
    // Components — resolve which file to fetch from (override → primary)
    {
        const fileKey = (0, kb_config_js_1.resolveFileKey)(cfg, "components");
        const reg = await (0, figma_rest_js_1.extractComponentsFromFigma)({ fileKey, token });
        const componentsFile = node_path_1.default.join(regDir, "components.json");
        const merged = await mergeLocalComponents(componentsFile, reg);
        await (0, promises_1.writeFile)(componentsFile, JSON.stringify(merged.registry, null, 2) + "\n");
        writes.push({
            registry: "components.json",
            fileKey,
            ...(merged.preserved > 0 ? { preserved: merged.preserved } : {}),
        });
    }
    // Variables — gracefully skip if the endpoint is unavailable (non-Enterprise
    // plans get a 403 on /variables/local). Existing variables.json is left
    // untouched so manual MCP refreshes remain authoritative.
    {
        const fileKey = (0, kb_config_js_1.resolveFileKey)(cfg, "variables");
        try {
            const reg = await (0, figma_rest_js_1.extractVariablesFromFigma)({ fileKey, token });
            await (0, promises_1.writeFile)(node_path_1.default.join(regDir, "variables.json"), JSON.stringify(reg, null, 2) + "\n");
            writes.push({ registry: "variables.json", fileKey });
        }
        catch (err) {
            if (err instanceof figma_rest_js_1.VariablesEndpointUnavailableError) {
                skips.push({
                    registry: "variables.json",
                    reason: `endpoint returned ${err.status} (Enterprise-only — refresh manually via MCP)`,
                });
            }
            else {
                throw err;
            }
        }
    }
    // Text styles
    {
        const fileKey = (0, kb_config_js_1.resolveFileKey)(cfg, "textStyles");
        const reg = await (0, figma_rest_js_1.extractTextStylesFromFigma)({ fileKey, token });
        await (0, promises_1.writeFile)(node_path_1.default.join(regDir, "text-styles.json"), JSON.stringify(reg, null, 2) + "\n");
        writes.push({ registry: "text-styles.json", fileKey });
    }
    const reportLines = [`# Bridge KB sync — ${cfg.dsName}`, ""];
    if (writes.length > 0) {
        reportLines.push("Registries refreshed from Figma:", "");
        for (const w of writes) {
            reportLines.push(`- \`${w.registry}\` (from \`${w.fileKey}\`)`);
        }
        reportLines.push("");
    }
    if (skips.length > 0) {
        reportLines.push("Skipped (existing files preserved):", "");
        for (const s of skips) {
            reportLines.push(`- \`${s.registry}\` — ${s.reason}`);
        }
        reportLines.push("");
    }
    await (0, promises_1.mkdir)(".bridge", { recursive: true });
    await (0, promises_1.writeFile)(".bridge/last-sync-report.md", reportLines.join("\n"), "utf8");
    return { extracted: true, dsName: cfg.dsName, writes, skips };
}
const invokedPath = process.argv[1] ?? "";
if (/[\\/]orchestrator\.(js|ts)$/.test(invokedPath)) {
    const configArgIdx = process.argv.indexOf("--config");
    const configPath = configArgIdx >= 0 ? process.argv[configArgIdx + 1] : "docs.config.yaml";
    runCron({ configPath })
        .then((r) => {
        console.log(JSON.stringify(r, null, 2));
    })
        .catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
//# sourceMappingURL=orchestrator.js.map