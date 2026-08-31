"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VariablesEndpointUnavailableError = void 0;
exports.extractVariablesFromFigma = extractVariablesFromFigma;
exports.extractComponentsFromFigma = extractComponentsFromFigma;
exports.extractTextStylesFromFigma = extractTextStylesFromFigma;
exports.extractFromFigma = extractFromFigma;
const BASE = "https://api.figma.com/v1";
async function fget(url, token, f = fetch) {
    const res = await f(url, { headers: { "X-Figma-Token": token } });
    if (!res.ok)
        throw new Error(`GET ${url} failed: ${res.status}`);
    return (await res.json());
}
/** Sentinel thrown when the variables endpoint is not available for the
 * token's plan tier. The Figma `/variables/local` REST endpoint is
 * Enterprise-only — non-Enterprise tokens get a 403. Callers should treat
 * this as "variables unavailable" rather than a hard error. */
class VariablesEndpointUnavailableError extends Error {
    status;
    constructor(status) {
        super(`Figma /variables/local returned ${status}. The endpoint is Enterprise-only; on other plans, refresh variables via the MCP path instead.`);
        this.status = status;
        this.name = "VariablesEndpointUnavailableError";
    }
}
exports.VariablesEndpointUnavailableError = VariablesEndpointUnavailableError;
function categoryFromPage(page) {
    if (!page)
        return "layout";
    const p = page.toLowerCase();
    if (p.includes("action"))
        return "actions";
    if (p.includes("form"))
        return "forms";
    if (p.includes("data") || p.includes("display"))
        return "data-display";
    if (p.includes("feedback"))
        return "feedback";
    if (p.includes("nav"))
        return "navigation";
    if (p.includes("overlay") || p.includes("modal") || p.includes("dialog"))
        return "overlay";
    if (p.includes("surface"))
        return "surface";
    return "layout";
}
async function extractVariablesFromFigma(opts) {
    if (!opts.token)
        throw new Error("FIGMA_TOKEN is required");
    const f = opts.fetchImpl ?? fetch;
    const ts = new Date().toISOString();
    const res = await f(`${BASE}/files/${opts.fileKey}/variables/local`, {
        headers: { "X-Figma-Token": opts.token },
    });
    if (!res.ok) {
        if (res.status === 403 || res.status === 404) {
            throw new VariablesEndpointUnavailableError(res.status);
        }
        throw new Error(`GET /variables/local failed: ${res.status}`);
    }
    const varsBody = (await res.json());
    const collections = varsBody.meta?.variableCollections ?? {};
    const varDefs = varsBody.meta?.variables ?? {};
    const modeLabelByCollection = {};
    for (const c of Object.values(collections)) {
        const modeMap = {};
        for (const m of c.modes ?? [])
            modeMap[m.modeId] = m.name;
        modeLabelByCollection[c.id] = modeMap;
    }
    const variables = Object.values(varDefs).map((v) => {
        const modeMap = modeLabelByCollection[v.variableCollectionId] ?? {};
        const valuesByMode = {};
        for (const [modeId, value] of Object.entries(v.valuesByMode ?? {})) {
            const label = modeMap[modeId] ?? modeId;
            valuesByMode[label] = value;
        }
        return {
            key: v.key,
            name: v.name,
            resolvedType: v.resolvedType,
            valuesByMode,
            scopes: v.scopes,
        };
    });
    return { version: 1, generatedAt: ts, variables };
}
/** Convert a Figma component-property definition into the string-encoded
 * form the Bridge compiler expects on disk:
 * - VARIANT(opt1,opt2,opt3) for variant props
 * - "BOOLEAN" / "TEXT" / "INSTANCE_SWAP" for the other types
 *
 * The compiler's variant validator (`lib/compiler/resolve.ts`) reads this
 * encoded string verbatim, so the format must match exactly. */
function encodePropertyDef(def) {
    if (def.type === "VARIANT") {
        const opts = def.variantOptions ?? [];
        return `VARIANT(${opts.join(",")})`;
    }
    return def.type;
}
const MAX_NODE_IDS_PER_BATCH = 50;
/** Fetch rich node data for the given Figma node IDs in batches. Returns a
 * flat map from node ID to the document. Missing nodes are silently
 * omitted (caller treats absence as "no metadata available"). */
async function fetchNodes(fileKey, ids, token, f) {
    const out = {};
    for (let i = 0; i < ids.length; i += MAX_NODE_IDS_PER_BATCH) {
        const batch = ids.slice(i, i + MAX_NODE_IDS_PER_BATCH);
        if (batch.length === 0)
            continue;
        const url = `${BASE}/files/${fileKey}/nodes?ids=${encodeURIComponent(batch.join(","))}&depth=1`;
        const body = await fget(url, token, f);
        for (const [id, entry] of Object.entries(body.nodes ?? {})) {
            if (entry?.document)
                out[id] = entry.document;
        }
    }
    return out;
}
async function extractComponentsFromFigma(opts) {
    if (!opts.token)
        throw new Error("FIGMA_TOKEN is required");
    const f = opts.fetchImpl ?? fetch;
    const ts = new Date().toISOString();
    // Pass 1: list components and component sets in parallel. /components
    // returns every variant instance inside a SET as a separate entry — the
    // Figma REST API does not expose a `componentSetId` field, so we cannot
    // filter on that. We deduplicate against the SET children list in pass 3.
    const [compBody, setBody] = await Promise.all([
        fget(`${BASE}/files/${opts.fileKey}/components`, opts.token, f),
        fget(`${BASE}/files/${opts.fileKey}/component_sets`, opts.token, f),
    ]);
    const allComponents = compBody.meta?.components ?? [];
    const componentSets = setBody.meta?.component_sets ?? [];
    // Pass 2: batch-fetch rich node data for every component-set ID so we can
    // read componentPropertyDefinitions, count variants, AND collect the
    // variant node IDs for the dedup pass.
    const setNodeIds = componentSets.map((s) => s.node_id).filter((id) => !!id);
    const nodeDocs = setNodeIds.length
        ? await fetchNodes(opts.fileKey, setNodeIds, opts.token, f)
        : {};
    // Pass 3: build the set of node IDs that belong to a COMPONENT_SET. Any
    // /components entry whose node_id is in this set is a variant instance,
    // not a standalone component — drop it.
    const variantNodeIds = new Set();
    for (const doc of Object.values(nodeDocs)) {
        for (const child of doc.children ?? [])
            variantNodeIds.add(child.id);
    }
    // Secondary heuristic: Figma's variant-naming convention requires every
    // variant name to be of the form `key=value` or `key1=value1, key2=value2`.
    // A small number of variants slip past the node-ID dedup when their parent
    // set is unpublished — we still want them out of the registry.
    const looksLikeVariantName = (name) => /^\w[\w-]*=/.test(name);
    const standaloneComps = allComponents.filter((c) => {
        if (c.node_id && variantNodeIds.has(c.node_id))
            return false;
        if (looksLikeVariantName(c.name))
            return false;
        return true;
    });
    // Emit the on-disk shape the compiler actually consumes — `properties` as a
    // record of string-encoded types, `variants` as the variant count, the
    // node id and containing page surfaced as `id` and `page`.
    const components = [];
    for (const set of componentSets) {
        const doc = set.node_id ? nodeDocs[set.node_id] : undefined;
        const propDefs = doc?.componentPropertyDefinitions ?? {};
        const properties = {};
        for (const [propKey, def] of Object.entries(propDefs)) {
            properties[propKey] = encodePropertyDef(def);
        }
        components.push({
            name: set.name,
            key: set.key,
            id: set.node_id,
            type: "COMPONENT_SET",
            variants: doc?.children?.length ?? 0,
            page: set.containing_frame?.pageName,
            category: categoryFromPage(set.containing_frame?.pageName),
            properties,
            description: set.description,
        });
    }
    for (const c of standaloneComps) {
        components.push({
            name: c.name,
            key: c.key,
            id: c.node_id,
            type: "COMPONENT",
            page: c.containing_frame?.pageName,
            category: categoryFromPage(c.containing_frame?.pageName),
            properties: {},
            description: c.description,
        });
    }
    // Cast to the typed registry. The on-disk type is intentionally looser
    // than the formal ComponentEntry interface — see lib/compiler/registry.ts
    // which normalizes either shape at read time.
    return {
        version: 1,
        generatedAt: ts,
        components: components,
    };
}
async function extractTextStylesFromFigma(opts) {
    if (!opts.token)
        throw new Error("FIGMA_TOKEN is required");
    const f = opts.fetchImpl ?? fetch;
    const ts = new Date().toISOString();
    const stylesBody = await fget(`${BASE}/files/${opts.fileKey}/styles`, opts.token, f);
    const stylesArr = stylesBody.meta?.styles ?? [];
    const textStylesOnly = stylesArr.filter((s) => s.style_type === "TEXT");
    // /styles carries no typography metrics — only the node that defines the
    // style does. Batch-fetch those nodes and read `document.style`. Styles
    // whose node is unreachable fall back to DEFAULT_TYPE_METRICS, which is
    // signalled on the entry via `metricsResolved: false` so downstream
    // consumers (the CSS emitter) can refuse to emit rather than silently
    // shipping wrong type.
    const styleNodeIds = textStylesOnly.map((s) => s.node_id).filter((id) => !!id);
    const styleDocs = styleNodeIds.length
        ? await fetchNodes(opts.fileKey, styleNodeIds, opts.token, f)
        : {};
    const textStyles = textStylesOnly.map((s) => {
        const style = s.node_id ? styleDocs[s.node_id]?.style : undefined;
        if (!style || style.fontSize == null) {
            return {
                key: s.key,
                name: s.name,
                ...DEFAULT_TYPE_METRICS,
                metricsResolved: false,
            };
        }
        return {
            key: s.key,
            name: s.name,
            fontFamily: style.fontFamily ?? DEFAULT_TYPE_METRICS.fontFamily,
            fontStyle: fontStyleFromWeight(style.fontWeight, style.italic),
            fontSize: style.fontSize,
            lineHeight: lineHeightFrom(style),
            ...(style.letterSpacing != null ? { letterSpacing: style.letterSpacing } : {}),
            metricsResolved: true,
        };
    });
    return {
        version: 1,
        generatedAt: ts,
        styles: textStyles,
    };
}
const DEFAULT_TYPE_METRICS = {
    fontFamily: "Inter",
    fontStyle: "Regular",
    fontSize: 14,
    lineHeight: 20,
};
/** Figma reports numeric weights; the Plugin API and the style registry use
 * named styles. Map to the closest standard name, appending Italic when the
 * node is italic. Unknown weights fall back to Regular. */
function fontStyleFromWeight(weight, italic) {
    const names = {
        100: "Thin",
        200: "ExtraLight",
        300: "Light",
        400: "Regular",
        500: "Medium",
        600: "SemiBold",
        700: "Bold",
        800: "ExtraBold",
        900: "Black",
    };
    const base = weight != null ? (names[weight] ?? "Regular") : "Regular";
    if (!italic)
        return base;
    return base === "Regular" ? "Italic" : `${base} Italic`;
}
/** Prefer the absolute pixel line height Figma computes. Percentage-authored
 * styles keep their ratio as a unitless string so CSS stays responsive. */
function lineHeightFrom(style) {
    if (style.lineHeightUnit === "FONT_SIZE_%" && style.lineHeightPercent != null) {
        return `${style.lineHeightPercent}%`;
    }
    if (style.lineHeightPx != null)
        return style.lineHeightPx;
    return DEFAULT_TYPE_METRICS.lineHeight;
}
async function extractFromFigma(opts) {
    const [variables, components, textStyles] = await Promise.all([
        extractVariablesFromFigma(opts),
        extractComponentsFromFigma(opts),
        extractTextStylesFromFigma(opts),
    ]);
    return { variables, components, textStyles };
}
//# sourceMappingURL=figma-rest.js.map