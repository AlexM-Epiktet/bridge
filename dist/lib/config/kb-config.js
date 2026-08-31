"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KBConfigSchema = void 0;
exports.resolveFileKey = resolveFileKey;
exports.parseKBConfig = parseKBConfig;
const js_yaml_1 = require("js-yaml");
const zod_1 = require("zod");
const CronCfg = zod_1.z.object({
    cadence: zod_1.z.string().default("daily"),
    time: zod_1.z.string().default("06:00"),
    maxPRsPerWeek: zod_1.z.number().int().positive().default(7),
    autoMergeIfTrivial: zod_1.z.boolean().default(false),
});
// Per-category Figma file overrides. Each entry is optional; absent entries
// fall back to the top-level `figmaFileKey`. Use this when a design system is
// split across multiple Figma libraries — e.g. components in one file,
// variables and text styles in a "Foundations" file.
const FigmaFilesCfg = zod_1.z
    .object({
    components: zod_1.z.string().optional(),
    variables: zod_1.z.string().optional(),
    textStyles: zod_1.z.string().optional(),
})
    .default({});
exports.KBConfigSchema = zod_1.z.object({
    dsName: zod_1.z.string().min(1),
    tagline: zod_1.z.string().optional(),
    figmaFileKey: zod_1.z.string().min(1),
    figmaFiles: FigmaFilesCfg,
    kbPath: zod_1.z.string().default("bridge-ds"),
    cron: CronCfg.default({}),
});
function resolveFileKey(cfg, category) {
    return cfg.figmaFiles[category] ?? cfg.figmaFileKey;
}
function parseKBConfig(raw) {
    // JSON_SCHEMA rejects custom YAML tags (e.g. `!!js/function`) that could
    // execute code at parse time. The config is plain data, so this is safe
    // and strictly tighter than the library default.
    const parsed = (0, js_yaml_1.load)(raw, { schema: js_yaml_1.JSON_SCHEMA });
    return exports.KBConfigSchema.parse(parsed);
}
//# sourceMappingURL=kb-config.js.map