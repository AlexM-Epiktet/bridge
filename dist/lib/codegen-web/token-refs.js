"use strict";
// ---------------------------------------------------------------------------
// token-refs.ts — resolve a DS token to a CSS reference, or refuse
// ---------------------------------------------------------------------------
//
// Code generation must never invent a value. A `$token` becomes CSS only when
// the knowledge base can prove what it points at, through one of two paths:
//
//   1. **Theme lockfile** (`theme-values.json`) — the token is already bound to
//      a custom property that exists in the consumer's stylesheet. This is the
//      authoritative path and the only one available on non-Enterprise plans,
//      where `/variables/local` returns 403 and `variables.json` holds keys
//      with no values.
//
//   2. **Resolved variable values** (`variables.json` with `valuesByMode`) —
//      the KB carries the value itself, so Bridge can emit its own stylesheet
//      and reference it.
//
// A token matching neither is *unbound*. It is reported, never approximated,
// and the emitter leaves a marked gap rather than a plausible-looking length.
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTokenRefs = buildTokenRefs;
exports.refFor = refFor;
const tokens_css_js_1 = require("./tokens-css.js");
/**
 * Build the token → CSS reference index from a loaded KB.
 *
 * Lockfile bindings win over generated ones: when a stylesheet already exists
 * and is verified in CI, emitting a competing definition of the same property
 * would put the two out of sync on the next theme change.
 */
function buildTokenRefs(values, opts = {}) {
    const byName = new Map();
    const byKey = new Map();
    const unbound = [];
    let needsGeneratedStylesheet = false;
    for (const v of values.variables) {
        const lockfile = values.themeByKey.get(v.key) ?? values.themeByName.get(v.name);
        if (lockfile) {
            const ref = {
                token: v.name,
                cssVar: lockfile.cssVar,
                reference: `var(${lockfile.cssVar})`,
                source: "theme-lockfile",
            };
            byName.set(v.name, ref);
            byKey.set(v.key, ref);
            continue;
        }
        if (Object.keys(v.valuesByMode).length > 0) {
            const cssVar = (0, tokens_css_js_1.cssVarName)(v.name, opts.prefix);
            const ref = {
                token: v.name,
                cssVar,
                reference: `var(${cssVar})`,
                source: "generated",
            };
            byName.set(v.name, ref);
            byKey.set(v.key, ref);
            needsGeneratedStylesheet = true;
            continue;
        }
        unbound.push({
            token: v.name,
            key: v.key,
            reason: "no value in variables.json and no theme-values.json binding — " +
                "the value is unknown to the knowledge base",
        });
    }
    // Lockfile entries whose Figma variable is absent from variables.json are
    // still usable: the CSS side is what code generation needs.
    for (const [figmaName, binding] of values.themeByName) {
        if (byName.has(figmaName))
            continue;
        const ref = {
            token: figmaName,
            cssVar: binding.cssVar,
            reference: `var(${binding.cssVar})`,
            source: "theme-lockfile",
        };
        byName.set(figmaName, ref);
        if (binding.figmaKey)
            byKey.set(binding.figmaKey, ref);
    }
    return {
        byName,
        byKey,
        unbound,
        needsGeneratedStylesheet,
        themeCssFile: values.themeCssFile,
    };
}
/**
 * Look up a resolved token (as carried on a resolved scene-graph node) and
 * return its CSS reference, or null when the KB cannot prove a value.
 *
 * Accepts either a `ResolvedToken`-shaped object (`{key, name}`) or a bare
 * token name.
 */
function refFor(index, token) {
    if (!token)
        return null;
    if (typeof token === "string") {
        const name = token.replace(/^\$/, "");
        return index.byName.get(name) ?? null;
    }
    if (typeof token === "object") {
        const t = token;
        if (typeof t.key === "string") {
            const byKey = index.byKey.get(t.key);
            if (byKey)
                return byKey;
        }
        if (typeof t.name === "string") {
            return index.byName.get(t.name.replace(/^\$/, "")) ?? null;
        }
    }
    return null;
}
//# sourceMappingURL=token-refs.js.map