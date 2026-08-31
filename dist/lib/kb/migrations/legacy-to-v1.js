"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateLegacyToV1 = migrateLegacyToV1;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const schema_version_js_1 = require("../schema-version.js");
async function exists(file) {
    try {
        await (0, promises_1.access)(file);
        return true;
    }
    catch {
        return false;
    }
}
async function stampFile(file) {
    if (!(await exists(file)))
        return;
    const raw = await (0, promises_1.readFile)(file, "utf8");
    const parsed = JSON.parse(raw);
    await (0, promises_1.writeFile)(file, JSON.stringify(stampVersion(parsed), null, 2) + "\n", "utf8");
}
function flattenComponents(legacy) {
    const flat = [];
    for (const [category, list] of Object.entries(legacy.components)) {
        for (const entry of list) {
            flat.push({ ...entry, category });
        }
    }
    return {
        version: schema_version_js_1.CURRENT_KB_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        components: flat,
    };
}
function stampVersion(parsed) {
    return {
        ...parsed,
        version: schema_version_js_1.CURRENT_KB_SCHEMA_VERSION,
        generatedAt: parsed.generatedAt ?? new Date().toISOString(),
    };
}
async function migrateLegacyToV1(kbPath) {
    const regDir = node_path_1.default.join(kbPath, "knowledge-base", "registries");
    const compFile = node_path_1.default.join(regDir, "components.json");
    const compRaw = await (0, promises_1.readFile)(compFile, "utf8");
    const compParsed = JSON.parse(compRaw);
    let compOut;
    if (Array.isArray(compParsed.components)) {
        compOut = stampVersion(compParsed);
    }
    else {
        compOut = flattenComponents(compParsed);
    }
    await (0, promises_1.writeFile)(compFile, JSON.stringify(compOut, null, 2) + "\n", "utf8");
    await stampFile(node_path_1.default.join(regDir, "variables.json"));
    await stampFile(node_path_1.default.join(regDir, "text-styles.json"));
    await stampFile(node_path_1.default.join(regDir, "icons.json"));
    await stampFile(node_path_1.default.join(regDir, "logos.json"));
    await stampFile(node_path_1.default.join(regDir, "illustrations.json"));
}
//# sourceMappingURL=legacy-to-v1.js.map