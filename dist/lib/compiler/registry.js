"use strict";
// ---------------------------------------------------------------------------
// registry.ts — load knowledge-base registries from disk
// ---------------------------------------------------------------------------
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadRegistry = loadRegistry;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const schema_version_js_1 = require("../kb/schema-version.js");
// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
/**
 * Safely read and parse a JSON file. Returns null if the file is missing.
 */
function readJSON(filePath) {
    if (!fs.existsSync(filePath))
        return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
/**
 * Generate segment keys from a slash-separated name.
 * For "color/background/neutral/boldest" produces:
 *   ["color", "color/background", "color/background/neutral"]
 * (every prefix except the full name itself)
 */
function segmentKeys(name) {
    const parts = name.split("/");
    const keys = [];
    for (let i = 1; i < parts.length; i++) {
        keys.push(parts.slice(0, i).join("/"));
    }
    return keys;
}
// ---------------------------------------------------------------------------
// INDEX BUILDERS
// ---------------------------------------------------------------------------
function normalizeVariables(data) {
    if (!data)
        return [];
    if (Array.isArray(data.variables))
        return data.variables;
    if (data.collections && typeof data.collections === "object") {
        const flat = [];
        for (const c of Object.values(data.collections)) {
            if (c && Array.isArray(c.variables))
                flat.push(...c.variables);
        }
        return flat;
    }
    return [];
}
function buildVariableIndex(data) {
    const byName = new Map();
    const bySegment = new Map();
    const variables = normalizeVariables(data);
    if (variables.length === 0)
        return { byName, bySegment };
    for (const v of variables) {
        const entry = { name: v.name, key: v.key, collection: "" };
        byName.set(v.name, entry);
        for (const seg of segmentKeys(v.name)) {
            let bucket = bySegment.get(seg);
            if (!bucket) {
                bucket = [];
                bySegment.set(seg, bucket);
            }
            bucket.push(entry);
        }
    }
    return { byName, bySegment };
}
function buildComponentIndex(data) {
    const byName = new Map();
    if (!data || !data.components)
        return { byName };
    for (const comp of data.components) {
        const entry = {
            name: comp.name,
            key: comp.key,
            type: comp.type ?? "COMPONENT",
            properties: Array.isArray(comp.properties)
                ? {}
                : (comp.properties ?? {}),
            ...(Array.isArray(comp.variants) ? { variants: comp.variants } : {}),
        };
        byName.set(comp.name.toLowerCase(), entry);
    }
    return { byName };
}
function buildTextStyleIndex(data) {
    const byName = new Map();
    const bySegment = new Map();
    if (!data || !data.styles)
        return { byName, bySegment };
    for (const s of data.styles) {
        const entry = { name: s.name, key: s.key };
        byName.set(s.name, entry);
        for (const seg of segmentKeys(s.name)) {
            let bucket = bySegment.get(seg);
            if (!bucket) {
                bucket = [];
                bySegment.set(seg, bucket);
            }
            bucket.push(entry);
        }
    }
    return { byName, bySegment };
}
function buildAssetIndex(data) {
    const byName = new Map();
    if (!data || !data.items)
        return { byName };
    for (const item of data.items) {
        const entry = { name: item.name, key: item.key, type: item.type };
        byName.set(item.name, entry);
    }
    return { byName };
}
// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
/**
 * Load all KB registry files and return a fully-indexed Registry object.
 */
function loadRegistry(kbPath) {
    (0, schema_version_js_1.assertKBCompatible)(kbPath);
    const regPath = path.join(kbPath, "knowledge-base", "registries");
    const variablesData = readJSON(path.join(regPath, "variables.json"));
    const componentsData = readJSON(path.join(regPath, "components.json"));
    const textStylesData = readJSON(path.join(regPath, "text-styles.json"));
    const iconsData = readJSON(path.join(regPath, "icons.json"));
    const logosData = readJSON(path.join(regPath, "logos.json"));
    const variables = buildVariableIndex(variablesData);
    const components = buildComponentIndex(componentsData);
    const textStyles = buildTextStyleIndex(textStylesData);
    const icons = buildAssetIndex(iconsData);
    const logos = buildAssetIndex(logosData);
    // Pre-compute name arrays for fuzzy matching
    const allVariableNames = Array.from(variables.byName.keys());
    const allComponentNames = Array.from(components.byName.keys());
    const allStyleNames = Array.from(textStyles.byName.keys());
    return {
        variables,
        components,
        textStyles,
        icons,
        logos,
        allVariableNames,
        allComponentNames,
        allStyleNames,
    };
}
//# sourceMappingURL=registry.js.map