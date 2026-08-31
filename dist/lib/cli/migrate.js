"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrate = migrate;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const schema_version_js_1 = require("../kb/schema-version.js");
const legacy_to_v1_js_1 = require("../kb/migrations/legacy-to-v1.js");
async function exists(file) {
    try {
        await (0, promises_1.access)(file);
        return true;
    }
    catch {
        return false;
    }
}
async function detectShape(kbPath) {
    const file = node_path_1.default.join(kbPath, "knowledge-base", "registries", "components.json");
    if (!(await exists(file)))
        return "corrupt";
    const raw = await (0, promises_1.readFile)(file, "utf8");
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return "corrupt";
    }
    if (Array.isArray(parsed.components)) {
        const v = typeof parsed.version === "number" ? parsed.version : 1;
        if (v > schema_version_js_1.CURRENT_KB_SCHEMA_VERSION)
            return "newer";
        return "current";
    }
    if (parsed.components && typeof parsed.components === "object")
        return "legacy-grouped";
    return "corrupt";
}
async function migrate(opts) {
    const shape = await detectShape(opts.kbPath);
    if (shape === "newer") {
        throw new schema_version_js_1.KBSchemaError(`KB schema is newer than this CLI supports (max ${schema_version_js_1.CURRENT_KB_SCHEMA_VERSION}). Upgrade @kinougarde/bridge-ds.`, "newer");
    }
    if (shape === "corrupt") {
        throw new schema_version_js_1.KBSchemaError(`KB at ${opts.kbPath} has an unrecognized shape or is missing. Re-run 'setup bridge'.`, "corrupt");
    }
    if (shape === "current") {
        return { migrated: false, from: "current", to: schema_version_js_1.CURRENT_KB_SCHEMA_VERSION };
    }
    await (0, legacy_to_v1_js_1.migrateLegacyToV1)(opts.kbPath);
    return { migrated: true, from: "legacy-grouped", to: schema_version_js_1.CURRENT_KB_SCHEMA_VERSION };
}
//# sourceMappingURL=migrate.js.map