"use strict";
// ---------------------------------------------------------------------------
// utility-map.ts — turn a resolved DS token into styling a framework can use
// ---------------------------------------------------------------------------
//
// Two strategies, because two kinds of codebase exist:
//
// - **`tailwind-daisyui`** — the target writes utility classes and never
//   references custom properties directly (`bg-primary`, not
//   `background: var(--color-primary)`). The class *name* is derived from the
//   custom property the theme lockfile already binds the token to, so the
//   mapping follows the design system rather than a guess.
//
// - **`css-vars`** — the target writes ordinary CSS declarations referencing
//   `var(--…)`. The generic fallback for codebases with no utility framework.
//
// Both refuse rather than approximate. A token the knowledge base cannot prove
// a binding for produces a flag and no styling at all, so the gap is visible in
// the generated code review instead of shipping a plausible wrong value.
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStyler = createStyler;
const token_refs_js_1 = require("./token-refs.js");
const EMPTY = { classes: [], declarations: [] };
/** CSS property driven by each role, for the css-vars strategy. */
const CSS_PROPERTY = {
    bg: "background-color",
    text: "color",
    border: "border-color",
    gap: "gap",
    p: "padding",
    pt: "padding-top",
    pr: "padding-right",
    pb: "padding-bottom",
    pl: "padding-left",
    rounded: "border-radius",
};
const COLOR_ROLES = new Set(["bg", "text", "border"]);
const SPACING_ROLES = new Set(["gap", "p", "pt", "pr", "pb", "pl"]);
/** Read the token's display name whether it arrives resolved or as a raw ref. */
function tokenName(token) {
    if (typeof token === "string")
        return token.replace(/^\$/, "");
    if (token && typeof token === "object") {
        const t = token;
        if (typeof t.name === "string")
            return t.name;
        if (typeof t.ref === "string")
            return t.ref.replace(/^\$/, "");
    }
    return "(unknown)";
}
/**
 * Derive the Tailwind spacing step from a token name.
 *
 * The daisyUI Figma library names its spacing variables `tailwind/spacing/4 (16)`
 * — the step is stated in the name, so reading it is a lookup rather than a
 * conversion from the pixel value. Tokens outside that namespace have no
 * derivable step and are refused.
 */
function tailwindSpacingStep(name) {
    const match = /^tailwind\/spacing\/([0-9]+(?:\.[0-9]+)?)\b/.exec(name);
    return match ? match[1] : null;
}
function flag(role, token, nodePath, reason) {
    return {
        classes: [],
        declarations: [],
        flag: { nodePath, role, token: tokenName(token), reason },
    };
}
/**
 * Utility-class styler.
 *
 * Colour and radius class names come from the custom property the theme
 * lockfile binds the token to: `--color-primary` → `primary`, `--radius-box` →
 * `box`. That indirection is what keeps the generated classes correct when the
 * design system renames a token — the lockfile is regenerated, and the class
 * name follows.
 */
function tailwindStyler(refs) {
    return {
        strategy: "tailwind-daisyui",
        styleFor(role, token, nodePath) {
            if (!token)
                return EMPTY;
            const name = tokenName(token);
            if (SPACING_ROLES.has(role)) {
                const step = tailwindSpacingStep(name);
                if (step === null) {
                    return flag(role, token, nodePath, `no Tailwind spacing step can be read from "${name}". Only tokens under ` +
                        `tailwind/spacing/* carry their step in the name; semantic spacing tokens ` +
                        `need a utility mapping before they can be generated.`);
                }
                return { classes: [`${role}-${step}`], declarations: [] };
            }
            const ref = (0, token_refs_js_1.refFor)(refs, token);
            if (!ref) {
                return flag(role, token, nodePath, `no CSS binding: the token has no value in variables.json and no ` +
                    `theme-values.json entry, so no utility class can be derived.`);
            }
            if (COLOR_ROLES.has(role)) {
                const colorName = ref.cssVar.startsWith("--color-")
                    ? ref.cssVar.slice("--color-".length)
                    : null;
                if (!colorName) {
                    return flag(role, token, nodePath, `bound to "${ref.cssVar}", which is not a --color-* property, so no ` +
                        `DaisyUI colour utility maps to it.`);
                }
                // A border colour is inert without a border width, so the width class
                // travels with it.
                return {
                    classes: role === "border" ? ["border", `border-${colorName}`] : [`${role}-${colorName}`],
                    declarations: [],
                };
            }
            // rounded
            const radiusName = ref.cssVar.startsWith("--radius-")
                ? ref.cssVar.slice("--radius-".length)
                : null;
            if (!radiusName) {
                return flag(role, token, nodePath, `bound to "${ref.cssVar}", which is not a --radius-* property, so no ` +
                    `rounded-* utility maps to it.`);
            }
            return { classes: [`rounded-${radiusName}`], declarations: [] };
        },
    };
}
/** Plain-CSS styler: every role becomes a declaration referencing `var(--…)`. */
function cssVarStyler(refs) {
    return {
        strategy: "css-vars",
        styleFor(role, token, nodePath) {
            if (!token)
                return EMPTY;
            const ref = (0, token_refs_js_1.refFor)(refs, token);
            if (!ref) {
                return flag(role, token, nodePath, `no CSS binding: the token has no value in variables.json and no ` +
                    `theme-values.json entry.`);
            }
            const declarations = [[CSS_PROPERTY[role], ref.reference]];
            if (role === "border")
                declarations.unshift(["border-width", "1px"]);
            return { classes: [], declarations };
        },
    };
}
function createStyler(strategy, refs) {
    return strategy === "css-vars" ? cssVarStyler(refs) : tailwindStyler(refs);
}
//# sourceMappingURL=utility-map.js.map