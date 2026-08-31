"use strict";
// ---------------------------------------------------------------------------
// component-bindings.ts — read the Figma ↔ code mapping out of the KB
// ---------------------------------------------------------------------------
//
// `components.json` entries may carry an `angular` block linking a Figma
// component to the real component that implements it:
//
//   { "name": "am-table", "key": "…", "angular": {
//       "selector": "am-table", "lib": "@amelis/foundation/web-ui",
//       "path": "libs/…/table.component.ts", "kind": "component" } }
//
// That mapping is maintained alongside the design system and is the only
// trustworthy way to turn `$comp/X` into a real element. Bridge reads it; it
// never invents one.
//
// Two `kind` values deliberately do NOT yield an element:
//   - `missing`  — the Figma component has no implementation yet.
//   - `daisyui`  — it is a framework primitive, styled with classes rather
//                  than wrapped in a component.
// Both fall through to the primitive path or to a flag, which is the point:
// the generator says "there is nothing to call here" instead of emitting an
// import that will not resolve.
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
exports.loadComponentBindings = loadComponentBindings;
exports.bindingFor = bindingFor;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
/** Kinds that describe something callable from a template. */
const ELEMENT_KINDS = new Set([
    "component",
    "variant",
    "composite",
    "page",
    "partial",
    "dialog",
    "template",
    "part",
    "app-root",
]);
/**
 * Load the Figma → Angular bindings from `<kbPath>/knowledge-base/registries/components.json`.
 *
 * A missing or malformed file yields an empty index rather than an error:
 * bindings are an enrichment, and a KB without them should still generate
 * markup (falling back to primitives and flags).
 */
function loadComponentBindings(kbPath) {
    const file = path.join(kbPath, "knowledge-base", "registries", "components.json");
    const byName = new Map();
    const byKey = new Map();
    const unusable = [];
    let components = [];
    try {
        const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
        if (Array.isArray(parsed.components))
            components = parsed.components;
    }
    catch {
        return { byName, byKey, unusable };
    }
    for (const c of components) {
        if (!c.angular || !c.name)
            continue;
        const kind = c.angular.kind ?? "component";
        const binding = {
            selector: c.angular.selector ?? null,
            lib: c.angular.lib ?? null,
            sourcePath: c.angular.path ?? null,
            kind,
            ...(c.angular.note ? { note: c.angular.note } : {}),
        };
        if (!binding.selector || !ELEMENT_KINDS.has(kind)) {
            unusable.push({
                name: c.name,
                kind,
                reason: !binding.selector
                    ? `binding declares no selector (kind: ${kind})`
                    : `kind "${kind}" does not describe a callable element`,
            });
            continue;
        }
        byName.set(c.name.toLowerCase(), binding);
        if (c.key)
            byKey.set(c.key, binding);
    }
    return { byName, byKey, unusable };
}
/** Look up a binding by resolved component token or by raw name. */
function bindingFor(index, component) {
    if (!component)
        return null;
    if (typeof component === "string") {
        const name = component.replace(/^\$comp\//, "").replace(/^\$/, "");
        return index.byName.get(name.toLowerCase()) ?? null;
    }
    if (typeof component === "object") {
        const c = component;
        if (typeof c.key === "string") {
            const hit = index.byKey.get(c.key);
            if (hit)
                return hit;
        }
        if (typeof c.name === "string") {
            return index.byName.get(c.name.toLowerCase()) ?? null;
        }
    }
    return null;
}
//# sourceMappingURL=component-bindings.js.map