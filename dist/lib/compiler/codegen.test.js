"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const codegen_js_1 = require("./codegen.js");
const helpers_js_1 = require("./helpers.js");
function singleChunk() {
    return {
        label: "build",
        index: 0,
        nodes: [],
        imports: { variables: [], components: [], textStyles: [] },
    };
}
(0, node_test_1.test)("root frame is placed in clear space, not hardcoded at (0,0)", () => {
    const code = (0, codegen_js_1.generateCode)(singleChunk(), {
        rootName: "Screen",
        rootWidth: 1440,
        rootHeight: 900,
    });
    strict_1.default.ok(code.includes("figma.currentPage.children"), "expected a scan over figma.currentPage.children for placement");
    strict_1.default.ok(!/root\.x\s*=\s*0\s*;/.test(code), "root.x must be computed, not hardcoded to 0");
    strict_1.default.ok(code.includes("figma.currentPage.appendChild(root)"));
});
// Reconstruct the runtime findPropKey from the injected helper block so we can
// test its matching behavior directly.
function loadFindPropKey() {
    return new Function(helpers_js_1.HELPER_BLOCK + "\nreturn findPropKey;")();
}
(0, node_test_1.test)("findPropKey matches exact name segment, not a shared prefix", () => {
    const findPropKey = loadFindPropKey();
    const compSet = {
        componentPropertyDefinitions: {
            "Label secondary#3:4": { type: "TEXT" },
            "Label#1:2": { type: "TEXT" },
            Size: { type: "VARIANT" },
        },
    };
    strict_1.default.equal(findPropKey(compSet, "Label", "TEXT"), "Label#1:2");
    strict_1.default.equal(findPropKey(compSet, "Size", "VARIANT"), "Size");
    strict_1.default.equal(findPropKey(compSet, "Nope", "TEXT"), undefined);
});
(0, node_test_1.test)("multiple imports are batched into a single Promise.all", () => {
    const chunk = {
        label: "build",
        index: 0,
        nodes: [],
        imports: {
            variables: [
                { kind: "variable", key: "VariableID:1:1", name: "color/bg", ref: "$color/bg" },
                { kind: "variable", key: "VariableID:1:2", name: "spacing/md", ref: "$spacing/md" },
            ],
            components: [{ kind: "component", key: "comp-button", name: "Button", ref: "$comp/Button" }],
            textStyles: [],
        },
    };
    const code = (0, codegen_js_1.generateCode)(chunk, { rootName: "S", rootWidth: 100, rootHeight: 100 });
    strict_1.default.ok(code.includes("Promise.all"), "imports must be batched via Promise.all");
});
(0, node_test_1.test)("a single import still compiles correctly", () => {
    const chunk = {
        label: "build",
        index: 0,
        nodes: [],
        imports: {
            variables: [{ kind: "variable", key: "VariableID:1:1", name: "color/bg", ref: "$color/bg" }],
            components: [],
            textStyles: [],
        },
    };
    const code = (0, codegen_js_1.generateCode)(chunk, { rootName: "S", rootWidth: 100, rootHeight: 100 });
    strict_1.default.ok(code.includes("importVariableByKeyAsync"));
});
(0, node_test_1.test)("multi-chunk preload destructures the same import names it stores on globalThis", () => {
    // ── FIXTURE ──────────────────────────────────────────────────────────────────
    // Build a preload chunk with: 2 variables + 1 component + 1 textStyle
    const imports = {
        variables: [
            {
                kind: "variable",
                key: "VariableID:10:1",
                name: "color/bg/default",
                ref: "$color/bg/default",
                importMethod: null,
            },
            {
                kind: "variable",
                key: "VariableID:10:2",
                name: "spacing/md",
                ref: "$spacing/md",
                importMethod: null,
            },
        ],
        components: [
            {
                kind: "component",
                key: "comp-button-key",
                name: "Button",
                ref: "$comp/Button",
                importMethod: null,
            },
        ],
        textStyles: [
            {
                kind: "textStyle",
                key: "style-heading-xl",
                name: "heading/xl",
                ref: "$text/heading/xl",
                importMethod: null,
            },
        ],
    };
    const preloadChunk = {
        label: "preload",
        index: 0,
        nodes: [],
        imports,
        bridgeExports: [],
        bridgeImports: [],
    };
    // ── PRELOAD CODE ──────────────────────────────────────────────────────────────
    const preloadCode = (0, codegen_js_1.generateCode)(preloadChunk, {
        isMultiChunk: true,
        rootName: "S",
        rootWidth: 100,
        rootHeight: 100,
    });
    // Must use Promise.all for batching
    strict_1.default.ok(preloadCode.includes("Promise.all"), "preload must batch imports via Promise.all");
    // ── EXTRACT DESTRUCTURED NAMES ────────────────────────────────────────────────
    // Match: var [name1, name2, ...] = await Promise.all([
    const destructureMatch = preloadCode.match(/var\s+\[([^\]]+)\]\s*=\s*await\s+Promise\.all/);
    strict_1.default.ok(destructureMatch, "expected a destructuring assignment from Promise.all");
    const destructuredNames = new Set(destructureMatch[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean));
    // ── EXTRACT globalThis.__bridge.<name> = <name> ENTRIES ──────────────────────
    // Match every line of the form: globalThis.__bridge.<name> = <name>;
    // We exclude `root` which is always added separately and is not in the Promise.all destructuring.
    const bridgeStoreRegex = /globalThis\.__bridge\.(\w+)\s*=\s*\1\s*;/g;
    const bridgeStoredNames = new Set();
    let m;
    while ((m = bridgeStoreRegex.exec(preloadCode)) !== null) {
        bridgeStoredNames.add(m[1]);
    }
    // Exclude `root` — it is stored on globalThis.__bridge separately (after frame creation),
    // not from the destructuring.
    bridgeStoredNames.delete("root");
    strict_1.default.ok(bridgeStoredNames.size > 0, "expected at least one non-root name stored on globalThis.__bridge");
    // ── INVARIANT: every stored name must appear in the destructuring ─────────────
    // This guards against order drift between emitImports() (which fills pairs[]) and
    // the forEach that stores on globalThis.__bridge (which iterates importNames Map).
    // If those two iterations ever diverge — e.g. different key sets — bridgeStoredNames
    // would contain a name absent from destructuredNames and the assertion below fails.
    for (const name of bridgeStoredNames) {
        strict_1.default.ok(destructuredNames.has(name), `globalThis.__bridge.${name} is stored but "${name}" is not in the Promise.all destructuring`);
    }
    // ── BUILD CHUNK ───────────────────────────────────────────────────────────────
    // Build chunks reconstruct var <name> = b.<name>; from context.allImports.
    const buildChunk = {
        label: "build-1",
        index: 1,
        nodes: [],
        imports: { variables: [], components: [], textStyles: [] },
        bridgeExports: [],
        bridgeImports: [],
    };
    const buildCode = (0, codegen_js_1.generateCode)(buildChunk, {
        isMultiChunk: true,
        allImports: imports,
        rootName: "S",
        rootWidth: 100,
        rootHeight: 100,
    });
    // ── EXTRACT RECONSTRUCTED NAMES ───────────────────────────────────────────────
    // Match every line: var <name> = b.<name>;
    const reconstructRegex = /var\s+(\w+)\s*=\s*b\.\1\s*;/g;
    const reconstructedNames = new Set();
    while ((m = reconstructRegex.exec(buildCode)) !== null) {
        reconstructedNames.add(m[1]);
    }
    // `root` is always reconstructed from b.root via a dedicated line ("var root = b.root;"),
    // not via allImports — mirror the same exclusion applied to bridgeStoredNames above.
    reconstructedNames.delete("root");
    strict_1.default.ok(reconstructedNames.size > 0, "expected at least one reconstructed import in build chunk");
    // ── INVARIANT: every reconstructed name must have appeared in preload destructuring ──
    // This guards the contract between emitBuildChunk (which calls importVarName on
    // context.allImports) and emitPreloadChunk (which calls importVarName on chunk.imports
    // via emitImports). Both must produce the same names for the same ImportEntry objects.
    for (const name of reconstructedNames) {
        strict_1.default.ok(destructuredNames.has(name), `build chunk uses "b.${name}" but "${name}" was not in preload destructuring`);
    }
    // Symmetry: preload destructured names (which exclude root) must equal reconstructed names
    strict_1.default.deepEqual([...destructuredNames].sort(), [...reconstructedNames].sort(), "preload destructuring and build reconstruction must cover the exact same import names");
});
//# sourceMappingURL=codegen.test.js.map