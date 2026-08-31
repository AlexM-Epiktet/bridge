"use strict";
// ---------------------------------------------------------------------------
// tokens-css.ts — emit a CSS custom-property stylesheet from KB token values
// ---------------------------------------------------------------------------
//
// One custom property per DS variable, one block per Figma mode. The default
// mode lands on `:root`; every other mode is emitted twice — once behind an
// explicit `[data-theme="<mode>"]` selector, once behind `prefers-color-scheme`
// for the modes that name a colour scheme — so a page honours both an explicit
// toggle and the OS setting.
//
// Values come from `loadTokenValues()`, which has already resolved aliases and
// converted colours. Nothing is inferred here: a variable with no value for a
// mode simply does not appear in that mode's block.
Object.defineProperty(exports, "__esModule", { value: true });
exports.cssVarName = cssVarName;
exports.emitTokensCss = emitTokensCss;
// Figma variable scopes that make a FLOAT a CSS length.
const LENGTH_SCOPES = new Set([
    "GAP",
    "WIDTH_HEIGHT",
    "CORNER_RADIUS",
    "STROKE_FLOAT",
    "PARAGRAPH_SPACING",
    "PARAGRAPH_INDENT",
    "FONT_SIZE",
    "LINE_HEIGHT",
    "LETTER_SPACING",
]);
// Scopes that make a FLOAT explicitly unitless.
const UNITLESS_SCOPES = new Set(["OPACITY", "FONT_WEIGHT"]);
// Fallback when scopes are absent or non-committal: leading segments that are
// dimensional by convention across design systems.
const LENGTH_NAME_PREFIXES = [
    "spacing",
    "space",
    "radius",
    "size",
    "sizing",
    "gap",
    "padding",
    "margin",
    "border",
    "stroke",
    "width",
    "height",
    "icon",
];
/**
 * Turn a DS token name into a CSS custom-property name.
 * `color/bg/primary` → `--color-bg-primary`
 */
function cssVarName(tokenName, prefix) {
    const slug = tokenName
        .replace(/^\$/, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
    return "--" + (prefix ? `${prefix}-` : "") + slug;
}
/**
 * Decide whether a FLOAT token is a length. Figma scopes are authoritative
 * when present; otherwise the token's leading name segment is used and the
 * caller is warned, because an unscoped bare number is genuinely ambiguous.
 */
function floatUnit(v, warnings) {
    const scopes = v.scopes ?? [];
    if (scopes.some((s) => UNITLESS_SCOPES.has(s)))
        return "";
    if (scopes.some((s) => LENGTH_SCOPES.has(s)))
        return "px";
    const head = v.name.split("/")[0]?.toLowerCase() ?? "";
    if (LENGTH_NAME_PREFIXES.includes(head))
        return "px";
    warnings.push(`variable "${v.name}": FLOAT with no dimensional scope and no dimensional name prefix — ` +
        `emitted unitless. Add a Figma scope (GAP, CORNER_RADIUS, …) if it is a length.`);
    return "";
}
/** Render one resolved value as a CSS value string. */
function renderValue(value, variable, warnings) {
    switch (value.kind) {
        case "color":
            // A fully opaque colour stays a plain hex so it reads well in devtools;
            // anything translucent uses the modern relative-colour-free form.
            return value.alpha >= 1
                ? value.hex
                : `color-mix(in srgb, ${value.hex} ${Math.round(value.alpha * 100)}%, transparent)`;
        case "number":
            return `${value.value}${floatUnit(variable, warnings)}`;
        case "string":
            return value.value;
        case "boolean":
            return value.value ? "1" : "0";
    }
}
/** CSS declarations for one mode, sorted by property name for stable diffs. */
function declarationsForMode(variables, mode, prefix, warnings) {
    const decls = [];
    for (const v of variables) {
        const value = v.valuesByMode[mode];
        if (!value)
            continue;
        decls.push(`  ${cssVarName(v.name, prefix)}: ${renderValue(value, v, warnings)};`);
    }
    return decls.sort();
}
/** Text styles become utility classes: `.text-heading-xl { … }`. */
function textStyleClass(style) {
    const slug = style.name
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
    const lineHeight = typeof style.lineHeight === "number" ? `${style.lineHeight}px` : style.lineHeight;
    const lines = [
        `.text-${slug} {`,
        `  font-family: ${JSON.stringify(style.fontFamily)}, sans-serif;`,
        `  font-size: ${style.fontSize}px;`,
        `  line-height: ${lineHeight};`,
        `  font-weight: ${weightFromStyleName(style.fontStyle)};`,
    ];
    if (style.fontStyle.toLowerCase().includes("italic")) {
        lines.push(`  font-style: italic;`);
    }
    if (style.letterSpacing != null && style.letterSpacing !== 0) {
        lines.push(`  letter-spacing: ${style.letterSpacing}px;`);
    }
    lines.push(`}`);
    return lines.join("\n");
}
/** Map a Figma style name back to a numeric CSS weight. */
function weightFromStyleName(styleName) {
    const n = styleName
        .toLowerCase()
        .replace(/\s*italic\s*/g, "")
        .trim();
    const table = {
        thin: 100,
        extralight: 200,
        ultralight: 200,
        light: 300,
        regular: 400,
        normal: 400,
        "": 400,
        medium: 500,
        semibold: 600,
        demibold: 600,
        bold: 700,
        extrabold: 800,
        ultrabold: 800,
        black: 900,
        heavy: 900,
    };
    return table[n] ?? 400;
}
/** Modes that map onto a `prefers-color-scheme` media query. */
function colorSchemeFor(mode) {
    const m = mode.toLowerCase();
    if (m === "dark")
        return "dark";
    if (m === "light")
        return "light";
    return null;
}
/**
 * Emit the token stylesheet.
 */
function emitTokensCss(index, opts = {}) {
    const warnings = [];
    const prefix = opts.prefix;
    const blocks = [];
    blocks.push("/* Generated by bridge-ds — do not edit.\n" +
        "   Source: knowledge-base/registries/{variables,text-styles}.json */");
    // Default mode → :root
    const rootDecls = declarationsForMode(index.variables, index.defaultMode, prefix, warnings);
    blocks.push(`:root {\n${rootDecls.join("\n")}\n}`);
    // Every other mode → explicit selector, plus a media query when the mode
    // names a colour scheme so the OS preference works without JS.
    for (const mode of index.modes) {
        if (mode === index.defaultMode)
            continue;
        const decls = declarationsForMode(index.variables, mode, prefix, warnings);
        if (decls.length === 0)
            continue;
        blocks.push(`[data-theme="${mode}"] {\n${decls.join("\n")}\n}`);
        const scheme = colorSchemeFor(mode);
        if (scheme) {
            blocks.push(`@media (prefers-color-scheme: ${scheme}) {\n` +
                `  :root:not([data-theme="${index.defaultMode}"]) {\n` +
                decls.map((d) => "  " + d).join("\n") +
                `\n  }\n}`);
        }
    }
    if (opts.includeTextStyles !== false) {
        const emittable = index.textStyles.filter((s) => s.metricsResolved);
        const skipped = index.textStyles.length - emittable.length;
        if (skipped > 0) {
            warnings.push(`${skipped} text style(s) skipped: typography metrics were not resolved from Figma.`);
        }
        if (emittable.length > 0) {
            blocks.push("/* Text styles */");
            for (const s of emittable.slice().sort((a, b) => a.name.localeCompare(b.name))) {
                blocks.push(textStyleClass(s));
            }
        }
    }
    const varNameByToken = new Map();
    for (const v of index.variables) {
        varNameByToken.set(v.name, cssVarName(v.name, prefix));
    }
    return {
        css: blocks.join("\n\n") + "\n",
        varNameByToken,
        warnings: [...index.warnings, ...warnings],
    };
}
//# sourceMappingURL=tokens-css.js.map