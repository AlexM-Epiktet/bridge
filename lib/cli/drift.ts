// lib/cli/drift.ts
//
// `bridge-ds drift` — on-demand, READ-ONLY drift probe.
//
// This is deliberately NOT a live/bidirectional sync. Bridge's transactional
// model (make → fix → done) is a feature, not a limitation. `drift` answers a
// single question on demand — "has anything moved since I last accepted the
// KB?" — and then recommends a command. It never writes a registry file; the
// only thing it may write is the baseline, and only when explicitly asked.
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  extractComponentsFromFigma,
  extractVariablesFromFigma,
  extractTextStylesFromFigma,
  VariablesEndpointUnavailableError,
} from "../extractors/figma-rest.js";
import { parseKBConfig, resolveFileKey } from "../config/kb-config.js";
import type { KBConfig, RegistryCategory } from "../config/kb-config.js";
import {
  hashRegistryEntries,
  readBaseline,
  writeBaseline,
  diffRegistry,
  type KBBaseline,
  type RegistryBaseline,
  type RegistryDiff,
} from "../kb/baseline.js";

export interface DriftOptions {
  /** KB root — registries live at `<kbPath>/knowledge-base/registries`. */
  kbPath: string;
  /** docs.config.yaml, for the Figma file key(s). Defaults to the repo root one. */
  configPath?: string;
  /** Write the new baseline after reporting. Never touches registry files. */
  updateBaseline?: boolean;
  /** Injectable fetch, for tests. */
  fetchImpl?: typeof fetch;
}

/** Which side of the comparison an entry describes. `upstream` = live Figma
 * vs baseline; `local` = the registry file on disk vs baseline. Both matter:
 * upstream drift means Figma moved, local drift means someone hand-edited. */
export type DriftSource = "upstream" | "local";

export interface RegistryDriftEntry {
  registry: string;
  source: DriftSource;
  diff: RegistryDiff;
  note?: string;
}

export interface DriftReport {
  registries: RegistryDriftEntry[];
  recommendations: string[];
  /** 0 = no drift, 1 = drift found. Non-fatal — the caller decides. */
  exitCode: number;
}

interface RegistrySpec {
  /** Registry file name; doubles as the baseline key. */
  file: string;
  category: RegistryCategory;
  /** Name of the payload array inside the registry envelope. */
  entriesField: string;
  extract: (fileKey: string, token: string, fetchImpl?: typeof fetch) => Promise<unknown>;
}

const REGISTRIES: RegistrySpec[] = [
  {
    file: "components.json",
    category: "components",
    entriesField: "components",
    extract: (fileKey, token, fetchImpl) =>
      extractComponentsFromFigma({ fileKey, token, fetchImpl }),
  },
  {
    file: "variables.json",
    category: "variables",
    entriesField: "variables",
    extract: (fileKey, token, fetchImpl) =>
      extractVariablesFromFigma({ fileKey, token, fetchImpl }),
  },
  {
    file: "text-styles.json",
    category: "textStyles",
    entriesField: "styles",
    extract: (fileKey, token, fetchImpl) =>
      extractTextStylesFromFigma({ fileKey, token, fetchImpl }),
  },
];

type Hashes = { hash: string; entryHashes: Record<string, string> };

/** Pull the payload array out of a registry envelope. Tolerant by design:
 * a malformed registry yields an empty entry set rather than an exception. */
function entriesOf(payload: unknown, field: string): Record<string, unknown>[] {
  if (typeof payload !== "object" || payload === null) return [];
  const arr = (payload as Record<string, unknown>)[field];
  if (!Array.isArray(arr)) return [];
  return arr.filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null);
}

/** Hash the on-disk registry. Returns null when the file is missing or
 * unparseable — an advisory command must not die on a broken KB. */
async function hashLocalRegistry(kbPath: string, spec: RegistrySpec): Promise<Hashes | null> {
  const file = path.join(kbPath, "knowledge-base", "registries", spec.file);
  try {
    const raw = await readFile(file, "utf8");
    return hashRegistryEntries(entriesOf(JSON.parse(raw), spec.entriesField));
  } catch {
    return null;
  }
}

/** Load the KB config, or null when it is absent/invalid. Without it we can
 * still run the local-vs-baseline half of the probe. */
async function loadConfig(configPath: string): Promise<KBConfig | null> {
  try {
    return parseKBConfig(await readFile(configPath, "utf8"));
  } catch {
    return null;
  }
}

function summarize(diff: RegistryDiff): string {
  const parts: string[] = [];
  if (diff.added.length) parts.push(`${diff.added.length} added`);
  if (diff.removed.length) parts.push(`${diff.removed.length} removed`);
  if (diff.modified.length) parts.push(`${diff.modified.length} modified`);
  return parts.join(", ");
}

export async function driftCommand(opts: DriftOptions): Promise<DriftReport> {
  const configPath = opts.configPath ?? "docs.config.yaml";
  const cfg = await loadConfig(configPath);
  const token = process.env.FIGMA_TOKEN;

  const baseline = await readBaseline(opts.kbPath);
  const previous: Record<string, RegistryBaseline> = baseline?.baselines ?? {};

  const registries: RegistryDriftEntry[] = [];
  const recommendations: string[] = [];
  const capturedAt = new Date().toISOString();
  // Baseline written only if `updateBaseline` is set. It mirrors the ON-DISK
  // registries, never the fresh Figma extraction: `drift` does not rewrite
  // registry files, so baselining upstream content would claim a sync that
  // never happened. Upstream drift therefore keeps being reported until
  // `bridge-ds cron` actually refreshes the files — which is the point.
  const nextBaselines: Record<string, RegistryBaseline> = { ...previous };

  let upstreamSkipReason: string | null = null;
  if (!cfg) upstreamSkipReason = `no usable KB config at ${configPath}`;
  else if (!token) upstreamSkipReason = "FIGMA_TOKEN is not set";

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
      recommendations.push(
        `${spec.file}: missing or unreadable in the local KB — run \`bridge-ds cron\` to rebuild it`
      );
    } else {
      const localDiff = diffRegistry(prev, local);
      registries.push({ registry: spec.file, source: "local", diff: localDiff });
      if (localDiff.status === "changed") {
        recommendations.push(
          `${spec.file} changed locally since the last baseline (${summarize(localDiff)}) — expected if you curate it by hand`
        );
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

    const fileKey = resolveFileKey(cfg as KBConfig, spec.category);
    let payload: unknown;
    try {
      payload = await spec.extract(fileKey, token as string, opts.fetchImpl);
    } catch (err) {
      // The /variables/local endpoint is Enterprise-only and 403s on most
      // plans. That is a capability gap, not drift — report and move on.
      if (err instanceof VariablesEndpointUnavailableError) {
        registries.push({
          registry: spec.file,
          source: "upstream",
          diff: { status: "unchanged", added: [], removed: [], modified: [] },
          note: `not probed — Figma /variables/local returned ${err.status} (Enterprise-only)`,
        });
        recommendations.push(
          `${spec.file}: upstream not probed (endpoint is Enterprise-only) — refresh manually via MCP if you suspect drift`
        );
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

    const upstream = hashRegistryEntries(entriesOf(payload, spec.entriesField));
    const upstreamDiff = diffRegistry(prev, upstream);
    registries.push({ registry: spec.file, source: "upstream", diff: upstreamDiff });
    if (upstreamDiff.status === "changed") {
      recommendations.push(
        `${spec.file}: ${summarize(upstreamDiff)} upstream — run \`bridge-ds cron\` to refresh`
      );
    }
  }

  if (!baseline) {
    recommendations.unshift(
      "No baseline recorded yet — run `bridge-ds drift --update-baseline` to record one; there was nothing to compare against on this run"
    );
  }

  const exitCode = registries.some((r) => r.diff.status === "changed") ? 1 : 0;
  if (exitCode === 0 && recommendations.length === 0) {
    recommendations.push("No drift detected — the KB matches Figma and the recorded baseline");
  }

  if (opts.updateBaseline) {
    const next: KBBaseline = { version: 1, baselines: nextBaselines };
    await writeBaseline(opts.kbPath, next);
  }

  return { registries, recommendations, exitCode };
}

/** Plain-text report. No colour codes: this output is piped into skill
 * transcripts and CI logs as often as it is read in a terminal. */
export function formatDriftReport(report: DriftReport): string {
  const lines: string[] = ["Bridge KB drift report", "======================", ""];

  const byRegistry = new Map<string, RegistryDriftEntry[]>();
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
      if (detail) lines.push(`           ${detail}`);
      for (const id of entry.diff.added) lines.push(`           + ${id}`);
      for (const id of entry.diff.removed) lines.push(`           - ${id}`);
      for (const id of entry.diff.modified) lines.push(`           ~ ${id}`);
    }
    lines.push("");
  }

  lines.push("Recommendations", "---------------");
  if (report.recommendations.length === 0) lines.push("(none)");
  for (const rec of report.recommendations) lines.push(`- ${rec}`);
  lines.push("");
  lines.push(report.exitCode === 0 ? "Result: no drift." : "Result: drift detected.");
  lines.push("No registry file was modified — `drift` is read-only.");

  return lines.join("\n");
}
