"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doctor = doctor;
const promises_1 = require("node:fs/promises");
const ui_js_1 = require("./ui.js");
const banner_js_1 = require("./banner.js");
async function doctor(version = "6.0.0") {
    if (process.stdout.isTTY && !process.env.CI)
        (0, banner_js_1.printBanner)("Diagnostic", version);
    console.log((0, ui_js_1.brand)("Environment"));
    console.log(`  ${ui_js_1.icons.pass} Node.js ${process.versions.node}`);
    try {
        await (0, promises_1.access)(".git");
        console.log(`  ${ui_js_1.icons.pass} Git repo detected`);
    }
    catch {
        console.log(`  ${ui_js_1.icons.fail} Not a git repo`);
    }
    console.log(`  ${ui_js_1.icons.pass} @kinougarde/bridge-ds ${version}`);
    console.log((0, ui_js_1.brand)("Configuration"));
    try {
        await (0, promises_1.access)("docs.config.yaml");
        console.log(`  ${ui_js_1.icons.pass} docs.config.yaml`);
    }
    catch {
        console.log(`  ${ui_js_1.icons.fail} docs.config.yaml missing`);
    }
    try {
        await (0, promises_1.access)("bridge-ds/knowledge-base/registries/components.json");
        console.log(`  ${ui_js_1.icons.pass} knowledge base registries`);
    }
    catch {
        console.log(`  ${ui_js_1.icons.warn} no registries yet — run setup`);
    }
    console.log((0, ui_js_1.brand)("Connectivity"));
    const token = process.env.FIGMA_TOKEN;
    if (!token)
        console.log(`  ${ui_js_1.icons.warn} FIGMA_TOKEN env var not set (ok for local, required in CI)`);
    else
        console.log(`  ${ui_js_1.icons.pass} FIGMA_TOKEN set`);
    console.log((0, ui_js_1.brand)("Cron"));
    try {
        await (0, promises_1.access)(".github/workflows/bridge-kb-cron.yml");
        console.log(`  ${ui_js_1.icons.pass} cron workflow installed`);
    }
    catch {
        console.log(`  ${ui_js_1.icons.warn} cron workflow missing`);
    }
}
//# sourceMappingURL=doctor.js.map