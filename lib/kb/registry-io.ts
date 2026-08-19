import { readFile, writeFile } from "node:fs/promises";

export type Category =
  | "actions"
  | "forms"
  | "data-display"
  | "feedback"
  | "navigation"
  | "layout"
  | "overlay"
  | "surface";
export type Status = "stable" | "beta" | "deprecated" | "experimental";

export interface ComponentEntry {
  key: string;
  name: string;
  category: Category;
  status: Status;
  variants: Array<{ name: string; values: string[] }>;
  properties: Array<{ name: string; type: string; default?: unknown }>;
  description?: string;
}
export interface ComponentRegistry {
  version: number;
  generatedAt: string;
  components: ComponentEntry[];
}

export interface VariableEntry {
  key: string;
  name: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  valuesByMode: Record<string, unknown>;
  scopes?: string[];
}
export interface VariableRegistry {
  version: number;
  generatedAt: string;
  variables: VariableEntry[];
}

export interface TextStyleEntry {
  key: string;
  name: string;
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
  lineHeight: number | string;
  letterSpacing?: number;
}
export interface TextStyleRegistry {
  version: number;
  generatedAt: string;
  styles: TextStyleEntry[];
}

async function readJSON<T>(file: string): Promise<T> {
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as T;
}

export async function readComponentRegistry(file: string): Promise<ComponentRegistry> {
  const r = await readJSON<ComponentRegistry>(file);
  if (!Array.isArray(r.components)) throw new Error(`${file}: components[] missing`);
  for (const c of r.components) {
    if (!c.key) throw new Error(`${file}: component "${c.name ?? "?"}" missing required "key"`);
  }
  return r;
}

export async function readVariableRegistry(file: string): Promise<VariableRegistry> {
  const r = await readJSON<VariableRegistry>(file);
  if (!Array.isArray(r.variables)) throw new Error(`${file}: variables[] missing`);
  for (const v of r.variables) {
    if (!v.key) throw new Error(`${file}: variable "${v.name ?? "?"}" missing required "key"`);
  }
  return r;
}

export async function readTextStyleRegistry(file: string): Promise<TextStyleRegistry> {
  const r = await readJSON<TextStyleRegistry>(file);
  if (!Array.isArray(r.styles)) throw new Error(`${file}: styles[] missing`);
  return r;
}

export async function writeRegistry(file: string, data: unknown): Promise<void> {
  await writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

// ---------------------------------------------------------------------------
// Local component registration
// ---------------------------------------------------------------------------

/**
 * A component created by Bridge rather than discovered in Figma.
 *
 * `properties` uses the **string-encoded** shape (`VARIANT(a,b,c)`, `"TEXT"`,
 * `"BOOLEAN"`, `"INSTANCE_SWAP"`) rather than the array shape declared on
 * {@link ComponentEntry}. That is deliberate: `lib/compiler/registry.ts` drops
 * array-shaped `properties` at read time, which silently disables variant
 * validation. The encoded record is the only shape the compiler actually
 * consumes.
 *
 * `source: "local"` marks the entry as not-yet-published, so the cron can
 * preserve it instead of overwriting it with a REST result that cannot
 * possibly contain it.
 */
export interface LocalComponentEntry {
  key: string;
  name: string;
  type: "COMPONENT" | "COMPONENT_SET";
  category?: string;
  properties: Record<string, string>;
  variantCount?: number;
  description?: string;
  source: "local";
  registeredAt: string;
}

/** Encode a variant axis the way the compiler's variant validator reads it. */
export function encodeVariantAxis(values: readonly string[]): string {
  return `VARIANT(${values.join(",")})`;
}

/**
 * Insert or replace a component in `components.json`, matching on `key` first
 * and on `name` second.
 *
 * The name fallback matters because a component re-created in Figma gets a new
 * key while keeping its name; without it the registry would accumulate a stale
 * duplicate that `resolve()` could pick over the live one.
 *
 * Reads and rewrites the whole file — there is no partial-write path, and the
 * registries are small enough that a full rewrite is the simpler contract.
 */
export async function upsertComponentEntry(
  file: string,
  entry: LocalComponentEntry
): Promise<{ action: "inserted" | "replaced"; total: number }> {
  let registry: ComponentRegistry;
  try {
    registry = await readComponentRegistry(file);
  } catch {
    registry = { version: 1, generatedAt: new Date().toISOString(), components: [] };
  }

  const components = registry.components as unknown as Array<Record<string, unknown>>;
  const existing = components.findIndex(
    (c) => c.key === entry.key || (typeof c.name === "string" && c.name === entry.name)
  );

  const action = existing >= 0 ? "replaced" : "inserted";
  if (existing >= 0) {
    components.splice(existing, 1, entry as unknown as Record<string, unknown>);
  } else {
    components.push(entry as unknown as Record<string, unknown>);
  }

  registry.generatedAt = new Date().toISOString();
  await writeRegistry(file, registry);

  return { action, total: components.length };
}
