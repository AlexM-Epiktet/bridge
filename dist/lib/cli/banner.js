"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printBanner = printBanner;
const ui_js_1 = require("./ui.js");
const BANNER = `██████╗ ██████╗ ██╗██████╗  ██████╗ ███████╗
██╔══██╗██╔══██╗██║██╔══██╗██╔════╝ ██╔════╝
██████╔╝██████╔╝██║██║  ██║██║  ███╗█████╗
██╔══██╗██╔══██╗██║██║  ██║██║   ██║██╔══╝
██████╔╝██║  ██║██║██████╔╝╚██████╔╝███████╗
╚═════╝ ╚═╝  ╚═╝╚═╝╚═════╝  ╚═════╝ ╚══════╝`;
function printBanner(tagline, version) {
    console.log("");
    console.log((0, ui_js_1.brand)(BANNER));
    console.log((0, ui_js_1.dim)(`  v${version} — ${tagline}`));
    console.log("");
}
//# sourceMappingURL=banner.js.map