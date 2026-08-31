"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KBSchemaError = exports.CURRENT_KB_SCHEMA_VERSION = void 0;
exports.readKBSchemaVersion = readKBSchemaVersion;
exports.assertKBCompatible = assertKBCompatible;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
exports.CURRENT_KB_SCHEMA_VERSION = 1;
class KBSchemaError extends Error {
    kind;
    constructor(message, kind) {
        super(message);
        this.kind = kind;
        this.name = "KBSchemaError";
    }
}
exports.KBSchemaError = KBSchemaError;
function probeComponentsShape(parsed) {
    if (!parsed || typeof parsed !== "object")
        return "corrupt";
    const obj = parsed;
    if (Array.isArray(obj.components))
        return "current";
    if (obj.components && typeof obj.components === "object" && !Array.isArray(obj.components)) {
        return "legacy-grouped";
    }
    return "corrupt";
}
function registriesDir(kbPath) {
    return node_path_1.default.join(kbPath, "knowledge-base", "registries");
}
function readKBSchemaVersion(kbPath) {
    const file = node_path_1.default.join(registriesDir(kbPath), "components.json");
    if (!(0, node_fs_1.existsSync)(file))
        return null;
    const raw = (0, node_fs_1.readFileSync)(file, "utf8");
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.version === "number")
            return parsed.version;
        return null;
    }
    catch {
        return null;
    }
}
function assertKBCompatible(kbPath) {
    const componentsFile = node_path_1.default.join(registriesDir(kbPath), "components.json");
    if (!(0, node_fs_1.existsSync)(componentsFile)) {
        throw new KBSchemaError(`No KB found at ${kbPath}. Run \`setup bridge\` first.`, "missing");
    }
    const raw = (0, node_fs_1.readFileSync)(componentsFile, "utf8");
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new KBSchemaError(`KB registries/components.json is not valid JSON.`, "corrupt");
    }
    const shape = probeComponentsShape(parsed);
    if (shape === "legacy-grouped") {
        throw new KBSchemaError(`KB at ${kbPath} uses a legacy grouped-by-category shape. Run \`bridge-ds migrate\` to convert it to schema v${exports.CURRENT_KB_SCHEMA_VERSION}.`, "legacy-grouped");
    }
    if (shape === "corrupt") {
        throw new KBSchemaError(`KB registries/components.json has an unrecognized shape.`, "corrupt");
    }
    const version = parsed.version ?? 1;
    if (version > exports.CURRENT_KB_SCHEMA_VERSION) {
        throw new KBSchemaError(`KB schema version ${version} is newer than this CLI supports (${exports.CURRENT_KB_SCHEMA_VERSION}). Upgrade @kinougarde/bridge-ds.`, "newer");
    }
}
//# sourceMappingURL=schema-version.js.map