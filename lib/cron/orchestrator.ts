// lib/cron/orchestrator.ts
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  extractComponentsFromFigma,
  extractVariablesFromFigma,
  extractTextStylesFromFigma,
  VariablesEndpointUnavailableError,
} from "../extractors/figma-rest.js";
import { parseKBConfig, resolveFileKey } from "../config/kb-config.js";

export interface CronOptions {
  configPath: string;
}

interface RegistryWrite {
  registry: string;
  fileKey: string;
  /** Entries carried over from the previous file rather than from Figma. */
  preserved?: number;
}

interface RegistrySkip {
  registry: string;
  reason: string;
}

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
export async function mergeLocalComponents(
  file: string,
  fresh: { components: unknown[] }
): Promise<{ registry: Record<string, unknown>; preserved: number }> {
  let previous: Array<Record<string, unknown>> = [];
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as { components?: unknown };
    if (Array.isArray(raw.components)) {
      previous = raw.components as Array<Record<string, unknown>>;
    }
  } catch {
    // No readable previous file — nothing to preserve.
  }

  const freshList = (fresh.components ?? []) as Array<Record<string, unknown>>;
  const freshByKey = new Map<string, Record<string, unknown>>();
  for (const c of freshList) {
    if (typeof c.key === "string") freshByKey.set(c.key, c);
  }

  let preserved = 0;

  // Graft hand-maintained bindings back onto the refreshed entries.
  for (const prev of previous) {
    if (!prev.angular || typeof prev.key !== "string") continue;
    const match = freshByKey.get(prev.key);
    if (match && match.angular === undefined) {
      match.angular = prev.angular;
      preserved++;
    }
  }

  // Carry over local components that publication has not yet promoted.
  const carried = previous.filter(
    (c) => c.source === "local" && (typeof c.key !== "string" || !freshByKey.has(c.key))
  );
  preserved += carried.length;

  return {
    registry: { ...fresh, components: [...freshList, ...carried] },
    preserved,
  };
}

export async function runCron(opts: CronOptions) {
  const raw = await readFile(opts.configPath, "utf8");
  const cfg = parseKBConfig(raw);
  const token = process.env.FIGMA_TOKEN;
  if (!token) throw new Error("FIGMA_TOKEN env var is required");

  const regDir = path.join(cfg.kbPath, "knowledge-base", "registries");
  await mkdir(regDir, { recursive: true });

  const writes: RegistryWrite[] = [];
  const skips: RegistrySkip[] = [];

  // Components — resolve which file to fetch from (override → primary)
  {
    const fileKey = resolveFileKey(cfg, "components");
    const reg = await extractComponentsFromFigma({ fileKey, token });
    const componentsFile = path.join(regDir, "components.json");
    const merged = await mergeLocalComponents(componentsFile, reg);
    await writeFile(componentsFile, JSON.stringify(merged.registry, null, 2) + "\n");
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
    const fileKey = resolveFileKey(cfg, "variables");
    try {
      const reg = await extractVariablesFromFigma({ fileKey, token });
      await writeFile(path.join(regDir, "variables.json"), JSON.stringify(reg, null, 2) + "\n");
      writes.push({ registry: "variables.json", fileKey });
    } catch (err) {
      if (err instanceof VariablesEndpointUnavailableError) {
        skips.push({
          registry: "variables.json",
          reason: `endpoint returned ${err.status} (Enterprise-only — refresh manually via MCP)`,
        });
      } else {
        throw err;
      }
    }
  }

  // Text styles
  {
    const fileKey = resolveFileKey(cfg, "textStyles");
    const reg = await extractTextStylesFromFigma({ fileKey, token });
    await writeFile(path.join(regDir, "text-styles.json"), JSON.stringify(reg, null, 2) + "\n");
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
  await mkdir(".bridge", { recursive: true });
  await writeFile(".bridge/last-sync-report.md", reportLines.join("\n"), "utf8");

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
