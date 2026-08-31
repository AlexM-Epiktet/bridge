"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const hash_js_1 = require("./hash.js");
(0, node_test_1.test)("stableStringify sorts object keys but preserves array order", () => {
    const obj = { b: 1, a: [3, 1, 2] };
    strict_1.default.equal((0, hash_js_1.stableStringify)(obj), '{"a":[3,1,2],"b":1}');
});
(0, node_test_1.test)("stableStringify handles nested objects", () => {
    strict_1.default.equal((0, hash_js_1.stableStringify)({ b: { d: 1, c: 2 }, a: 1 }), '{"a":1,"b":{"c":2,"d":1}}');
});
(0, node_test_1.test)("sha256 is deterministic for equivalent objects", () => {
    strict_1.default.equal((0, hash_js_1.sha256)({ x: 1, y: 2 }), (0, hash_js_1.sha256)({ y: 2, x: 1 }));
});
(0, node_test_1.test)("sha256 returns 64-char hex", () => {
    strict_1.default.match((0, hash_js_1.sha256)({ any: "payload" }), /^[0-9a-f]{64}$/);
});
//# sourceMappingURL=hash.test.js.map