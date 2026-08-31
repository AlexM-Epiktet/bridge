"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const registry_js_1 = require("./registry.js");
const resolve_js_1 = require("./resolve.js");
// Variables in the Finary KB are namespaced under their collection
// (e.g. `layout/spacing/medium`, `layout/radius/medium`). The scoring
// system used to give equal weight to a match-via-name-only ("medium")
// and a match-with-category ("radius/medium"), and broke ties by
// insertion order — so `$radius/medium` resolved to `layout/spacing/medium`
// whenever the spacing entry appeared first. This test locks in the fix:
// segments that include the category MUST win over name-only matches.
function fixture() {
    const dir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-cat-bias-"));
    const regDir = node_path_1.default.join(dir, "knowledge-base", "registries");
    (0, node_fs_1.mkdirSync)(regDir, { recursive: true });
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "components.json"), JSON.stringify({ version: 1, components: [] }));
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "variables.json"), JSON.stringify({
        version: 1,
        variables: [
            // Order matters: spacing/medium comes first, so a category-blind
            // tiebreak would pick it for both $spacing/medium and $radius/medium.
            { name: "layout/spacing/medium", key: "spacing_med_key" },
            { name: "layout/radius/medium", key: "radius_med_key" },
        ],
    }));
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(regDir, "text-styles.json"), JSON.stringify({ styles: [] }));
    return dir;
}
(0, node_test_1.test)("resolveTokenRef picks the category-matching variable, not the first-inserted one", () => {
    const dir = fixture();
    try {
        const reg = (0, registry_js_1.loadRegistry)(dir);
        const spacing = (0, resolve_js_1.resolveTokenRef)("$spacing/medium", reg);
        const radius = (0, resolve_js_1.resolveTokenRef)("$radius/medium", reg);
        strict_1.default.equal(spacing.error, null);
        strict_1.default.equal(radius.error, null);
        strict_1.default.equal(spacing.resolved?.key, "spacing_med_key");
        strict_1.default.equal(radius.resolved?.key, "radius_med_key");
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
//# sourceMappingURL=resolve.category-bias.test.js.map