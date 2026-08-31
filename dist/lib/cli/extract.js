"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractHeadless = extractHeadless;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const kb_config_js_1 = require("../config/kb-config.js");
const figma_rest_js_1 = require("../extractors/figma-rest.js");
async function extractHeadless(opts = {}) {
    const cfgPath = opts.configPath ?? "docs.config.yaml";
    const raw = await (0, promises_1.readFile)(cfgPath, "utf8");
    const cfg = (0, kb_config_js_1.parseKBConfig)(raw);
    const token = process.env.FIGMA_TOKEN;
    if (!token)
        throw new Error("FIGMA_TOKEN env var is required");
    const result = await (0, figma_rest_js_1.extractFromFigma)({ fileKey: cfg.figmaFileKey, token });
    const outBase = opts.output ?? node_path_1.default.join(cfg.kbPath, "knowledge-base");
    await (0, promises_1.mkdir)(node_path_1.default.join(outBase, "registries"), { recursive: true });
    await (0, promises_1.writeFile)(node_path_1.default.join(outBase, "registries", "variables.json"), JSON.stringify(result.variables, null, 2) + "\n");
    await (0, promises_1.writeFile)(node_path_1.default.join(outBase, "registries", "components.json"), JSON.stringify(result.components, null, 2) + "\n");
    await (0, promises_1.writeFile)(node_path_1.default.join(outBase, "registries", "text-styles.json"), JSON.stringify(result.textStyles, null, 2) + "\n");
    return {
        variables: result.variables.variables.length,
        components: result.components.components.length,
        textStyles: result.textStyles.styles.length,
    };
}
//# sourceMappingURL=extract.js.map