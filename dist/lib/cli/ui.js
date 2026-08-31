"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.icons = exports.bold = exports.warn = exports.error = exports.success = exports.dim = exports.brandBg = exports.brand = void 0;
const picocolors_1 = __importDefault(require("picocolors"));
const BRAND_R = 244, BRAND_G = 91, BRAND_B = 38;
const rgb = (r, g, b) => (s) => `\x1b[38;2;${r};${g};${b}m${s}\x1b[0m`;
exports.brand = rgb(BRAND_R, BRAND_G, BRAND_B);
const brandBg = (s) => `\x1b[48;2;${BRAND_R};${BRAND_G};${BRAND_B}m\x1b[97m${s}\x1b[0m`;
exports.brandBg = brandBg;
exports.dim = picocolors_1.default.dim;
exports.success = picocolors_1.default.green;
exports.error = picocolors_1.default.red;
exports.warn = picocolors_1.default.yellow;
exports.bold = picocolors_1.default.bold;
exports.icons = {
    pass: (0, exports.success)("✓"),
    fail: (0, exports.error)("✗"),
    info: (0, exports.brand)("◆"),
    warn: (0, exports.warn)("▲"),
};
//# sourceMappingURL=ui.js.map