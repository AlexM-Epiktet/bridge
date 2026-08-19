// ---------------------------------------------------------------------------
// values.ts — value-aware KB loader
// ---------------------------------------------------------------------------
//
// `lib/compiler/registry.ts` deliberately drops every token *value* at load
// time: the Figma pipeline only ever needs the key, because the compiler binds
// variables rather than inlining values. Code generation is the opposite — it
// needs the resolved value and nothing else.
//
// This module is that second reader. It never feeds the Figma pipeline, so the
// determinism guarantees of `loadRegistry()` are untouched.
//
// Three things happen here that no other reader does:
//   1. Figma RGBA floats (0–1) become CSS hex.
//   2. VARIABLE_ALIAS indirection is followed, with cycle detection.
//   3. Modes are ordered so the default one can seed `:root`.
//
// Anything that cannot be resolved is reported in `warnings` and omitted. No
// value is ever guessed — an unresolvable token is absent from the output, and
// the emitter refuses to reference it.

import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type TokenValue =
  | { kind: "color"; hex: string; alpha: number }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "boolean"; value: boolean };

export interface TokenVariable {
  key: string;
  id?: string;
  name: string;
  resolvedType: string;
  /** Figma variable scopes (GAP, CORNER_RADIUS, OPACITY, …). The authoritative
   * signal for whether a FLOAT is a length or a bare ratio. */
  scopes?: string[];
  /** Mode label → resolved value. Modes whose value could not be resolved are absent. */
  valuesByMode: Record<string, TokenValue>;
}

export interface TokenTextStyle {
  key: string;
  name: string;
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
  lineHeight: number | string;
  letterSpacing?: number;
  /** False when the extractor could not read real metrics from Figma. */
  metricsResolved: boolean;
}

/**
 * One entry of the theme lockfile: a Figma variable bound to a CSS custom
 * property that already exists in the consumer's stylesheet.
 *
 * This is the authoritative binding when present. Figma's `/variables/local`
 * REST endpoint is Enterprise-only, so on most plans `variables.json` carries
 * keys with no values at all — the lockfile is then the *only* path from a
 * `$token` to something a browser can read.
 */
export interface ThemeBinding {
  cssVar: string;
  figmaName?: string;
  figmaKey?: string;
  type?: string;
  cssValue: string;
}

export interface TokenValueIndex {
  variables: TokenVariable[];
  variableByName: Map<string, TokenVariable>;
  variableByKey: Map<string, TokenVariable>;
  textStyles: TokenTextStyle[];
  textStyleByName: Map<string, TokenTextStyle>;
  textStyleByKey: Map<string, TokenTextStyle>;
  /** Theme-lockfile bindings, indexed by Figma variable name and by key. */
  themeByName: Map<string, ThemeBinding>;
  themeByKey: Map<string, ThemeBinding>;
  /** Stylesheet the lockfile mirrors, when it declares one. */
  themeCssFile: string | null;
  /** Mode labels in first-seen order, with the default mode first. */
  modes: string[];
  defaultMode: string;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// On-disk shapes
// ---------------------------------------------------------------------------

interface RawVariable {
  key?: string;
  id?: string;
  name?: string;
  resolvedType?: string;
  scopes?: string[];
  valuesByMode?: Record<string, unknown>;
}

interface RawVariablesFile {
  variables?: RawVariable[];
  collections?: Record<string, { variables?: RawVariable[] }>;
}

interface RawTextStyle {
  key?: string;
  name?: string;
  fontFamily?: string;
  fontStyle?: string;
  fontSize?: number;
  lineHeight?: number | string;
  letterSpacing?: number;
  metricsResolved?: boolean;
}

interface RawTextStylesFile {
  styles?: RawTextStyle[];
}

interface RawThemeValuesFile {
  cssFile?: string;
  tokens?: Array<{
    cssVar?: string;
    figmaName?: string;
    figmaKey?: string;
    type?: string;
    cssValue?: string;
  }>;
}

interface RawAlias {
  type: "VARIABLE_ALIAS";
  id: string;
}

// ---------------------------------------------------------------------------
// VALUE CONVERSION
// ---------------------------------------------------------------------------

/** Clamp to [0,1] then scale to a 0–255 integer. */
function channel(v: number): number {
  const clamped = v < 0 ? 0 : v > 1 ? 1 : v;
  return Math.round(clamped * 255);
}

function hex2(n: number): string {
  return n.toString(16).padStart(2, "0");
}

/**
 * Convert a Figma RGBA record (floats 0–1) to a CSS hex string plus a
 * separate alpha. Alpha is kept out of the hex so the emitter can choose
 * between `#rrggbb` and `rgb(... / alpha)` per context.
 */
export function rgbaToHex(rgba: { r: number; g: number; b: number; a?: number }): {
  hex: string;
  alpha: number;
} {
  const hex = "#" + hex2(channel(rgba.r)) + hex2(channel(rgba.g)) + hex2(channel(rgba.b));
  const alpha = rgba.a == null ? 1 : Math.max(0, Math.min(1, rgba.a));
  return { hex, alpha };
}

function isAlias(v: unknown): v is RawAlias {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as { type?: unknown }).type === "VARIABLE_ALIAS" &&
    typeof (v as { id?: unknown }).id === "string"
  );
}

function isRgba(v: unknown): v is { r: number; g: number; b: number; a?: number } {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.r === "number" && typeof o.g === "number" && typeof o.b === "number";
}

/** Convert a non-alias raw value into a TokenValue. Returns null if the shape
 * is not one we can represent — callers turn that into a warning. */
function toTokenValue(raw: unknown): TokenValue | null {
  if (isRgba(raw)) {
    const { hex, alpha } = rgbaToHex(raw);
    return { kind: "color", hex, alpha };
  }
  if (typeof raw === "number") return { kind: "number", value: raw };
  if (typeof raw === "string") return { kind: "string", value: raw };
  if (typeof raw === "boolean") return { kind: "boolean", value: raw };
  return null;
}

// ---------------------------------------------------------------------------
// ALIAS RESOLUTION
// ---------------------------------------------------------------------------

const MAX_ALIAS_DEPTH = 16;

/**
 * Follow a VARIABLE_ALIAS chain to a concrete value.
 *
 * Aliases point at a variable *id*, but the registry indexes by *key* — the
 * two are different namespaces in Figma, and only the MCP extraction path
 * writes `id` at all. We therefore try `id` first, then `key` as a fallback
 * for KBs that happen to use the same string for both. A chain that cannot be
 * followed yields null and a warning; it is never approximated.
 */
function resolveAlias(
  alias: RawAlias,
  byId: Map<string, RawVariable>,
  byKey: Map<string, RawVariable>,
  mode: string,
  warnings: string[],
  ownerName: string
): TokenValue | null {
  const seen = new Set<string>();
  let current: RawAlias = alias;

  for (let depth = 0; depth < MAX_ALIAS_DEPTH; depth++) {
    if (seen.has(current.id)) {
      warnings.push(
        `variable "${ownerName}" mode "${mode}": alias cycle detected at "${current.id}" — value omitted`
      );
      return null;
    }
    seen.add(current.id);

    const target = byId.get(current.id) ?? byKey.get(current.id);
    if (!target) {
      warnings.push(
        `variable "${ownerName}" mode "${mode}": alias target "${current.id}" not found in the registry — ` +
          `value omitted (aliases reference variable ids, which only the MCP extraction path records)`
      );
      return null;
    }

    // An alias may resolve through a different mode set; fall back to the
    // target's only mode when the label does not exist there.
    const targetModes = target.valuesByMode ?? {};
    const raw =
      mode in targetModes
        ? targetModes[mode]
        : Object.keys(targetModes).length === 1
          ? Object.values(targetModes)[0]
          : undefined;

    if (raw === undefined) {
      warnings.push(
        `variable "${ownerName}" mode "${mode}": alias target "${target.name ?? current.id}" has no value for that mode — value omitted`
      );
      return null;
    }

    if (isAlias(raw)) {
      current = raw;
      continue;
    }

    const value = toTokenValue(raw);
    if (!value) {
      warnings.push(
        `variable "${ownerName}" mode "${mode}": alias target "${target.name ?? current.id}" has an unsupported value shape — value omitted`
      );
    }
    return value;
  }

  warnings.push(
    `variable "${ownerName}" mode "${mode}": alias chain exceeded ${MAX_ALIAS_DEPTH} hops — value omitted`
  );
  return null;
}

// ---------------------------------------------------------------------------
// LOADING
// ---------------------------------------------------------------------------

function readJSON<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Flatten both on-disk variable shapes: a flat `variables[]` array (v1
 * schema) or `collections{}` keyed by collection name (MCP export). */
function flattenVariables(data: RawVariablesFile | null): RawVariable[] {
  if (!data) return [];
  if (Array.isArray(data.variables)) return data.variables;
  if (data.collections && typeof data.collections === "object") {
    const flat: RawVariable[] = [];
    for (const c of Object.values(data.collections)) {
      if (c && Array.isArray(c.variables)) flat.push(...c.variables);
    }
    return flat;
  }
  return [];
}

/**
 * Pick the mode that seeds `:root`. "light" wins when present because that is
 * the near-universal default in Figma files; otherwise the first mode seen,
 * which is stable for a given registry file.
 */
function pickDefaultMode(modes: readonly string[]): string {
  const light = modes.find((m) => m.toLowerCase() === "light");
  return light ?? modes[0] ?? "default";
}

/**
 * Load token *values* from the knowledge base at `kbPath`.
 *
 * Mirrors the layout used by `loadRegistry()`: `<kbPath>/knowledge-base/registries`.
 */
export function loadTokenValues(kbPath: string): TokenValueIndex {
  const regPath = path.join(kbPath, "knowledge-base", "registries");
  const warnings: string[] = [];

  const rawVars = flattenVariables(
    readJSON<RawVariablesFile>(path.join(regPath, "variables.json"))
  );
  const rawStyles =
    readJSON<RawTextStylesFile>(path.join(regPath, "text-styles.json"))?.styles ?? [];

  // Alias lookup tables, built before resolution so forward references work.
  const byId = new Map<string, RawVariable>();
  const byKey = new Map<string, RawVariable>();
  for (const v of rawVars) {
    if (v.id) byId.set(v.id, v);
    if (v.key) byKey.set(v.key, v);
  }

  // Mode labels in first-seen order.
  const modeOrder: string[] = [];
  for (const v of rawVars) {
    for (const mode of Object.keys(v.valuesByMode ?? {})) {
      if (!modeOrder.includes(mode)) modeOrder.push(mode);
    }
  }
  const defaultMode = pickDefaultMode(modeOrder);
  const modes = modeOrder.includes(defaultMode)
    ? [defaultMode, ...modeOrder.filter((m) => m !== defaultMode)]
    : modeOrder.slice();

  const variables: TokenVariable[] = [];
  for (const v of rawVars) {
    if (!v.key || !v.name) {
      warnings.push(`variable entry missing "key" or "name" — skipped`);
      continue;
    }

    const values: Record<string, TokenValue> = {};
    for (const [mode, raw] of Object.entries(v.valuesByMode ?? {})) {
      const resolved = isAlias(raw)
        ? resolveAlias(raw, byId, byKey, mode, warnings, v.name)
        : toTokenValue(raw);
      if (resolved) {
        values[mode] = resolved;
      } else if (!isAlias(raw)) {
        warnings.push(
          `variable "${v.name}" mode "${mode}": unsupported value shape — value omitted`
        );
      }
    }

    variables.push({
      key: v.key,
      ...(v.id ? { id: v.id } : {}),
      name: v.name,
      resolvedType: v.resolvedType ?? "STRING",
      ...(Array.isArray(v.scopes) ? { scopes: v.scopes } : {}),
      valuesByMode: values,
    });
  }

  const placeholderMetrics = hasPlaceholderTypeMetrics(rawStyles);
  if (placeholderMetrics) {
    warnings.push(
      `text-styles.json: all ${rawStyles.length} styles share one metric signature ` +
        `(Inter/Regular/14/20). That is the fingerprint of the pre-7.4 REST extractor, which ` +
        `hardcoded metrics instead of reading them. Treating every style as unresolved — ` +
        `re-extract to emit typography.`
    );
  }

  const textStyles: TokenTextStyle[] = [];
  for (const s of rawStyles) {
    if (!s.key || !s.name) {
      warnings.push(`text style entry missing "key" or "name" — skipped`);
      continue;
    }
    const metricsResolved = s.metricsResolved !== false && !placeholderMetrics;
    if (!metricsResolved && s.metricsResolved === false) {
      warnings.push(
        `text style "${s.name}": typography metrics were not resolved from Figma — refusing to emit type for it. ` +
          `Re-run extraction so the style's defining node is readable.`
      );
    }
    textStyles.push({
      key: s.key,
      name: s.name,
      fontFamily: s.fontFamily ?? "Inter",
      fontStyle: s.fontStyle ?? "Regular",
      fontSize: s.fontSize ?? 14,
      lineHeight: s.lineHeight ?? 20,
      ...(s.letterSpacing != null ? { letterSpacing: s.letterSpacing } : {}),
      metricsResolved,
    });
  }

  // ── Theme lockfile ───────────────────────────────────────────────────────
  const themeRaw = readJSON<RawThemeValuesFile>(path.join(regPath, "theme-values.json"));
  const themeByName = new Map<string, ThemeBinding>();
  const themeByKey = new Map<string, ThemeBinding>();
  for (const t of themeRaw?.tokens ?? []) {
    if (!t.cssVar || !t.cssValue) continue;
    const binding: ThemeBinding = {
      cssVar: t.cssVar,
      ...(t.figmaName ? { figmaName: t.figmaName } : {}),
      ...(t.figmaKey ? { figmaKey: t.figmaKey } : {}),
      ...(t.type ? { type: t.type } : {}),
      cssValue: t.cssValue,
    };
    if (t.figmaName) themeByName.set(t.figmaName, binding);
    if (t.figmaKey) themeByKey.set(t.figmaKey, binding);
  }

  return {
    variables,
    variableByName: new Map(variables.map((v) => [v.name, v])),
    variableByKey: new Map(variables.map((v) => [v.key, v])),
    textStyles,
    textStyleByName: new Map(textStyles.map((s) => [s.name, s])),
    textStyleByKey: new Map(textStyles.map((s) => [s.key, s])),
    themeByName,
    themeByKey,
    themeCssFile: themeRaw?.cssFile ?? null,
    modes,
    defaultMode,
    warnings,
  };
}

/**
 * Detect the known-bad output of the pre-7.4 REST text-style extractor, which
 * wrote `Inter / Regular / 14 / 20` for every style because `/styles` carries
 * no typography metrics and it never fetched the defining nodes.
 *
 * A real design system with several text styles never has one uniform metric
 * signature, so uniformity across more than one style is a reliable tell. This
 * matches a fingerprint of our own past output — it is not a judgement about
 * the user's data.
 */
function hasPlaceholderTypeMetrics(styles: readonly RawTextStyle[]): boolean {
  if (styles.length < 2) return false;
  return styles.every(
    (s) =>
      s.metricsResolved === undefined &&
      s.fontFamily === "Inter" &&
      s.fontStyle === "Regular" &&
      s.fontSize === 14 &&
      s.lineHeight === 20
  );
}
