"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.driftCommand = driftCommand;
exports.formatDriftReport = formatDriftReport;
// lib/cli/drift.ts
//
// `bridge-ds drift` — on-demand, READ-ONLY drift probe.
//
// This is deliberately NOT a live/bidirectional sync. Bridge's transactional
// model (make → fix → done) is a feature, not a limitation. `drift` answers a
// single question on demand — "has anything moved since I last accepted the
// KB?" — and then recommends a command. It never writes a registry file; the
// only thing it may write is the baseline, and only when explicitly asked.
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const figma_rest_js_1 = require("../extractors/figma-rest.js");
const kb_config_js_1 = require("../config/kb-config.js");
const baseline_js_1 = require("../kb/baseline.js");
const REGISTRIES = [
    {
        file: "components.json",
        category: "components",
        entriesField: "components",
        extract: (fileKey, token, fetchImpl) => (0, figma_rest_js_1.extractComponentsFromFigma)({ fileKey, token, fetchImpl }),
    },
    {
        file: "variables.json",
        category: "variables",
        entriesField: "variables",
        extract: (fileKey, token, fetchImpl) => (0, figma_rest_js_1.extractVariablesFromFigma)({ fileKey, token, fetchImpl }),
    },
    {
        file: "text-styles.json",
        category: "textStyles",
        entriesField: "styles",
        extract: (fileKey, token, fetchImpl) => (0, figma_rest_js_1.extractTextStylesFromFigma)({ fileKey, token, fetchImpl }),
    },
];
/** Pull the payload array out of a registry envelope. Tolerant by design:
 * a malformed registry yields an empty entry set rather than an exception. */
function entriesOf(payload, field) {
    if (typeof payload !== "object" || payload === null)
        return [];
    const arr = payload[field];
    if (!Array.isArray(arr))
        return [];
    return arr.filter((e) => typeof e === "object" && e !== null);
}
/** Hash the on-disk registry. Returns null when the file is missing or
 * unparseable — an advisory command must not die on a broken KB. */
async function hashLocalRegistry(kbPath, spec) {
    const file = node_path_1.default.join(kbPath, "knowledge-base", "registries", spec.file);
    try {
        const raw = await (0, promises_1.readFile)(file, "utf8");
        return (0, baseline_js_1.hashRegistryEntries)(entriesOf(JSON.parse(raw), spec.entriesField));
    }
    catch {
        return null;
    }
}
/** Load the KB config, or null when it is absent/invalid. Without it we can
 * still run the local-vs-baseline half of the probe. */
async function loadConfig(configPath) {
    try {
        return (0, kb_config_js_1.parseKBConfig)(await (0, promises_1.readFile)(configPath, "utf8"));
    }
    catch {
        return null;
    }
}
function summarize(diff) {
    const parts = [];
    if (diff.added.length)
        parts.push(`${diff.added.length} added`);
    if (diff.removed.length)
        parts.push(`${diff.removed.length} removed`);
    if (diff.modified.length)
        parts.push(`${diff.modified.length} modified`);
    return parts.join(", ");
}
async function driftCommand(opts) {
    const configPath = opts.configPath ?? "docs.config.yaml";
    const cfg = await loadConfig(configPath);
    const token = process.env.FIGMA_TOKEN;
    const baseline = await (0, baseline_js_1.readBaseline)(opts.kbPath);
    const previous = baseline?.baselines ?? {};
    const registries = [];
    const recommendations = [];
    const capturedAt = new Date().toISOString();
    // Baseline written only if `updateBaseline` is set. It mirrors the ON-DISK
    // registries, never the fresh Figma extraction: `drift` does not rewrite
    // registry files, so baselining upstream content would claim a sync that
    // never happened. Upstream drift therefore keeps being reported until
    // `bridge-ds cron` actually refreshes the files — which is the point.
    const nextBaselines = { ...previous };
    let upstreamSkipReason = null;
    if (!cfg)
        upstreamSkipReason = `no usable KB config at ${configPath}`;
    else if (!token)
        upstreamSkipReason = "FIGMA_TOKEN is not set";
    for (const spec of REGISTRIES) {
        const prev = previous[spec.file];
        // --- local (on disk) vs baseline -------------------------------------
        const local = await hashLocalRegistry(opts.kbPath, spec);
        if (!local) {
            registries.push({
                registry: spec.file,
                source: "local",
                diff: { status: "new", added: [], removed: [], modified: [] },
                note: "not readable on disk (missing or invalid JSON)",
            });
            recommendations.push(`${spec.file}: missing or unreadable in the local KB — run \`bridge-ds cron\` to rebuild it`);
        }
        else {
            const localDiff = (0, baseline_js_1.diffRegistry)(prev, local);
            registries.push({ registry: spec.file, source: "local", diff: localDiff });
            if (localDiff.status === "changed") {
                recommendations.push(`${spec.file} changed locally since the last baseline (${summarize(localDiff)}) — expected if you curate it by hand`);
            }
            nextBaselines[spec.file] = {
                hash: local.hash,
                entryCount: Object.keys(local.entryHashes).length,
                entryHashes: local.entryHashes,
                capturedAt,
            };
        }
        // --- upstream (live Figma) vs baseline --------------------------------
        if (upstreamSkipReason) {
            registries.push({
                registry: spec.file,
                source: "upstream",
                diff: { status: "unchanged", added: [], removed: [], modified: [] },
                note: `not probed — ${upstreamSkipReason}`,
            });
            continue;
        }
        const fileKey = (0, kb_config_js_1.resolveFileKey)(cfg, spec.category);
        let payload;
        try {
            payload = await spec.extract(fileKey, token, opts.fetchImpl);
        }
        catch (err) {
            // The /variables/local endpoint is Enterprise-only and 403s on most
            // plans. That is a capability gap, not drift — report and move on.
            if (err instanceof figma_rest_js_1.VariablesEndpointUnavailableError) {
                registries.push({
                    registry: spec.file,
                    source: "upstream",
                    diff: { status: "unchanged", added: [], removed: [], modified: [] },
                    note: `not probed — Figma /variables/local returned ${err.status} (Enterprise-only)`,
                });
                recommendations.push(`${spec.file}: upstream not probed (endpoint is Enterprise-only) — refresh manually via MCP if you suspect drift`);
                continue;
            }
            registries.push({
                registry: spec.file,
                source: "upstream",
                diff: { status: "unchanged", added: [], removed: [], modified: [] },
                note: `not probed — extraction failed: ${err instanceof Error ? err.message : String(err)}`,
            });
            continue;
        }
        const upstream = (0, baseline_js_1.hashRegistryEntries)(entriesOf(payload, spec.entriesField));
        const upstreamDiff = (0, baseline_js_1.diffRegistry)(prev, upstream);
        registries.push({ registry: spec.file, source: "upstream", diff: upstreamDiff });
        if (upstreamDiff.status === "changed") {
            recommendations.push(`${spec.file}: ${summarize(upstreamDiff)} upstream — run \`bridge-ds cron\` to refresh`);
        }
    }
    if (!baseline) {
        recommendations.unshift("No baseline recorded yet — run `bridge-ds drift --update-baseline` to record one; there was nothing to compare against on this run");
    }
    const exitCode = registries.some((r) => r.diff.status === "changed") ? 1 : 0;
    if (exitCode === 0 && recommendations.length === 0) {
        recommendations.push("No drift detected — the KB matches Figma and the recorded baseline");
    }
    if (opts.updateBaseline) {
        const next = { version: 1, baselines: nextBaselines };
        await (0, baseline_js_1.writeBaseline)(opts.kbPath, next);
    }
    return { registries, recommendations, exitCode };
}
/** Plain-text report. No colour codes: this output is piped into skill
 * transcripts and CI logs as often as it is read in a terminal. */
function formatDriftReport(report) {
    const lines = ["Bridge KB drift report", "======================", ""];
    const byRegistry = new Map();
    for (const entry of report.registries) {
        const list = byRegistry.get(entry.registry) ?? [];
        list.push(entry);
        byRegistry.set(entry.registry, list);
    }
    for (const [registry, entries] of byRegistry) {
        lines.push(registry);
        for (const entry of entries) {
            const head = `  ${entry.source.padEnd(8)} ${entry.diff.status}`;
            lines.push(entry.note ? `${head} (${entry.note})` : head);
            const detail = summarize(entry.diff);
            if (detail)
                lines.push(`           ${detail}`);
            for (const id of entry.diff.added)
                lines.push(`           + ${id}`);
            for (const id of entry.diff.removed)
                lines.push(`           - ${id}`);
            for (const id of entry.diff.modified)
                lines.push(`           ~ ${id}`);
        }
        lines.push("");
    }
    lines.push("Recommendations", "---------------");
    if (report.recommendations.length === 0)
        lines.push("(none)");
    for (const rec of report.recommendations)
        lines.push(`- ${rec}`);
    lines.push("");
    lines.push(report.exitCode === 0 ? "Result: no drift." : "Result: drift detected.");
    lines.push("No registry file was modified — `drift` is read-only.");
    return lines.join("\n");
}
//# sourceMappingURL=drift.js.map