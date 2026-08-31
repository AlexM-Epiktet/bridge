"use strict";
// lib/lint/builtin-functions.test.ts
// Focused unit tests for the 5 real built-in custom functions shipped in
// v7.1.0. We drive them through `runRulesAgainstDocument` rather than
// invoking the closures directly — that exercises the factory wiring
// (engine.ts -> buildBridgeBuiltinFunctions) end-to-end without coupling
// the tests to internal exports.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const engine_js_1 = require("./engine.js");
const kb_loader_js_1 = require("./kb-loader.js");
const KB_FIXTURE_SRC = node_path_1.default.resolve("test/fixtures/lint/kb");
/** Create a temp cwd with the lint KB fixture copied under bridge-ds/knowledge-base. */
function makeKBCwd(prefix) {
    const dir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), prefix));
    const dest = node_path_1.default.join(dir, "bridge-ds", "knowledge-base");
    (0, node_fs_1.mkdirSync)(dest, { recursive: true });
    (0, node_fs_1.cpSync)(KB_FIXTURE_SRC, dest, { recursive: true });
    (0, kb_loader_js_1._resetKBCache)();
    return dir;
}
function makeRule(id, partial) {
    return {
        rules: {
            [id]: {
                id,
                description: partial.description ?? id,
                given: partial.given,
                then: partial.then,
                severity: partial.severity ?? "error",
                meta: {
                    bridgeApi: "1.x",
                    category: "structure",
                    surface: ["lint-time"],
                    status: "active",
                    since: "1.0.0",
                    ...(partial.meta ?? {}),
                },
            },
        },
    };
}
// ---------------------------------------------------------------------------
// text-is-english
// ---------------------------------------------------------------------------
(0, node_test_1.test)("text-is-english: French copy with 2+ stopwords triggers", async () => {
    const ruleset = makeRule("english-only", {
        given: "$.description",
        then: { function: "text-is-english" },
    });
    const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { description: "Une carte qui affiche les avoirs crypto." }, { source: "test.cspec.yaml" });
    strict_1.default.equal(r.diagnostics.length, 1, JSON.stringify(r.diagnostics));
    strict_1.default.match(r.diagnostics[0].message, /French markers/);
});
(0, node_test_1.test)("text-is-english: English copy passes silently", async () => {
    const ruleset = makeRule("english-only", {
        given: "$.description",
        then: { function: "text-is-english" },
    });
    const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { description: "A card surfacing the user's crypto holdings with daily PnL." }, { source: "test.cspec.yaml" });
    strict_1.default.equal(r.diagnostics.length, 0);
});
(0, node_test_1.test)("text-is-english: allowList suppresses listed words", async () => {
    // "de" is a common French stopword; without allowList this would trigger
    // alongside "la". With allowList it drops below the default threshold of 2.
    const ruleset = makeRule("english-only", {
        given: "$.description",
        then: {
            function: "text-is-english",
            functionOptions: { allowList: ["de", "la"] },
        },
    });
    const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { description: "Token de la token" }, { source: "test.cspec.yaml" });
    strict_1.default.equal(r.diagnostics.length, 0, JSON.stringify(r.diagnostics));
});
// ---------------------------------------------------------------------------
// snapshot-exists
// ---------------------------------------------------------------------------
(0, node_test_1.test)("snapshot-exists: passes when sibling snapshot file is present", async () => {
    const dir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-snapshot-pass-"));
    try {
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(dir, "foo.cspec.yaml"), "name: foo\n");
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(dir, "foo-snapshot.json"), "{}");
        const ruleset = makeRule("snapshot", {
            given: "$",
            then: { function: "snapshot-exists" },
        });
        const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { name: "foo" }, { source: "foo.cspec.yaml", cwd: dir });
        strict_1.default.equal(r.diagnostics.length, 0);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("snapshot-exists: emits diagnostic when snapshot is missing", async () => {
    const dir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-snapshot-fail-"));
    try {
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(dir, "foo.cspec.yaml"), "name: foo\n");
        const ruleset = makeRule("snapshot", {
            given: "$",
            then: { function: "snapshot-exists" },
        });
        const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { name: "foo" }, { source: "foo.cspec.yaml", cwd: dir });
        strict_1.default.equal(r.diagnostics.length, 1, JSON.stringify(r.diagnostics));
        strict_1.default.match(r.diagnostics[0].message, /Missing snapshot/);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
// ---------------------------------------------------------------------------
// filename-pattern
// ---------------------------------------------------------------------------
(0, node_test_1.test)("filename-pattern: kebab-case filename passes", async () => {
    const ruleset = makeRule("filename", {
        given: "$",
        then: {
            function: "filename-pattern",
            functionOptions: { match: "^[a-z][a-z0-9-]*\\.cspec\\.yaml$" },
        },
    });
    const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { name: "ok" }, { source: "crypto-card.cspec.yaml" });
    strict_1.default.equal(r.diagnostics.length, 0);
});
(0, node_test_1.test)("filename-pattern: PascalCase filename fails", async () => {
    const ruleset = makeRule("filename", {
        given: "$",
        then: {
            function: "filename-pattern",
            functionOptions: { match: "^[a-z][a-z0-9-]*\\.cspec\\.yaml$" },
        },
    });
    const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { name: "bad" }, { source: "CryptoCard.cspec.yaml" });
    strict_1.default.equal(r.diagnostics.length, 1, JSON.stringify(r.diagnostics));
    strict_1.default.match(r.diagnostics[0].message, /does not match required pattern/);
});
// ---------------------------------------------------------------------------
// property-key-has-figma-suffix
// ---------------------------------------------------------------------------
(0, node_test_1.test)("property-key-has-figma-suffix: non-variant key without suffix emits", async () => {
    const ruleset = makeRule("suffix", {
        given: "$.properties",
        then: { function: "property-key-has-figma-suffix" },
    });
    const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, {
        properties: {
            state: "VARIANT(default | loading)", // exempt
            label: "Bitcoin", // missing suffix → emits
            "amount#1057:4": "$42,000", // ok
        },
    }, { source: "test.cspec.yaml" });
    strict_1.default.equal(r.diagnostics.length, 1, JSON.stringify(r.diagnostics));
    strict_1.default.match(r.diagnostics[0].message, /label/);
    strict_1.default.match(r.diagnostics[0].message, /missing Figma node-id suffix/);
});
(0, node_test_1.test)("property-key-has-figma-suffix: variant key and suffixed key both pass", async () => {
    const ruleset = makeRule("suffix", {
        given: "$.properties",
        then: { function: "property-key-has-figma-suffix" },
    });
    const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, {
        properties: {
            state: "VARIANT(default | loading)",
            "label#1057:0": "Bitcoin",
        },
    }, { source: "test.cspec.yaml" });
    strict_1.default.equal(r.diagnostics.length, 0, JSON.stringify(r.diagnostics));
});
// ---------------------------------------------------------------------------
// rule-has-bridge-api
// ---------------------------------------------------------------------------
(0, node_test_1.test)("rule-has-bridge-api: missing field emits diagnostic", async () => {
    const ruleset = makeRule("meta", {
        given: "$.rules.*",
        then: { function: "rule-has-bridge-api" },
    });
    const doc = {
        rules: {
            "custom-rule": {
                description: "x",
                given: "$",
                then: { function: "truthy" },
                severity: "warn",
                meta: { category: "copy" }, // no bridgeApi
            },
        },
    };
    const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, doc, { source: "ruleset.yaml" });
    strict_1.default.equal(r.diagnostics.length, 1, JSON.stringify(r.diagnostics));
    strict_1.default.match(r.diagnostics[0].message, /missing meta\.bridgeApi/);
});
(0, node_test_1.test)("rule-has-bridge-api: invalid format emits diagnostic", async () => {
    const ruleset = makeRule("meta", {
        given: "$.rules.*",
        then: { function: "rule-has-bridge-api" },
    });
    const doc = {
        rules: {
            "custom-rule": {
                meta: { bridgeApi: "not-a-version" },
            },
        },
    };
    const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, doc, { source: "ruleset.yaml" });
    strict_1.default.equal(r.diagnostics.length, 1, JSON.stringify(r.diagnostics));
    strict_1.default.match(r.diagnostics[0].message, /not a recognizable semver range/);
});
(0, node_test_1.test)("rule-has-bridge-api: valid range passes", async () => {
    const ruleset = makeRule("meta", {
        given: "$.rules.*",
        then: { function: "rule-has-bridge-api" },
    });
    for (const v of ["1.x", "1.0.x", "1.0.0", "^1.0.0", "~1.0.0"]) {
        const doc = {
            rules: { "custom-rule": { meta: { bridgeApi: v } } },
        };
        const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, doc, { source: "ruleset.yaml" });
        strict_1.default.equal(r.diagnostics.length, 0, `expected pass for ${v} — got ${JSON.stringify(r.diagnostics)}`);
    }
});
// ---------------------------------------------------------------------------
// token-exists-in-kb
// ---------------------------------------------------------------------------
(0, node_test_1.test)("token-exists-in-kb: existing token passes silently", async () => {
    const dir = makeKBCwd("bridge-token-exists-pass-");
    try {
        const ruleset = makeRule("token-exists", {
            given: "$..tokens[*].name",
            then: { function: "token-exists-in-kb" },
        });
        const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { tokens: [{ name: "$color/background/surface/subtle" }] }, { source: "x.cspec.yaml", cwd: dir });
        strict_1.default.equal(r.diagnostics.length, 0, JSON.stringify(r.diagnostics));
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("token-exists-in-kb: missing token emits diagnostic with suggestions", async () => {
    const dir = makeKBCwd("bridge-token-exists-fail-");
    try {
        const ruleset = makeRule("token-exists", {
            given: "$..tokens[*].name",
            then: { function: "token-exists-in-kb" },
        });
        const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { tokens: [{ name: "$color/nope/whatever" }] }, { source: "x.cspec.yaml", cwd: dir });
        strict_1.default.equal(r.diagnostics.length, 1, JSON.stringify(r.diagnostics));
        strict_1.default.match(r.diagnostics[0].message, /does not exist in the KB/);
        strict_1.default.match(r.diagnostics[0].message, /Did you mean/);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("token-exists-in-kb: no KB → silently skips", async () => {
    (0, kb_loader_js_1._resetKBCache)();
    const dir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-token-exists-nokb-"));
    try {
        const ruleset = makeRule("token-exists", {
            given: "$..tokens[*].name",
            then: { function: "token-exists-in-kb" },
        });
        const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { tokens: [{ name: "$color/nope/whatever" }] }, { source: "x.cspec.yaml", cwd: dir });
        strict_1.default.equal(r.diagnostics.length, 0, JSON.stringify(r.diagnostics));
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
// ---------------------------------------------------------------------------
// token-not-deprecated
// ---------------------------------------------------------------------------
(0, node_test_1.test)("token-not-deprecated: non-deprecated token passes", async () => {
    const dir = makeKBCwd("bridge-deprecated-pass-");
    try {
        const ruleset = makeRule("not-deprecated", {
            given: "$..tokens[*].name",
            then: { function: "token-not-deprecated" },
        });
        const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { tokens: [{ name: "$color/background/surface/subtle" }] }, { source: "x.cspec.yaml", cwd: dir });
        strict_1.default.equal(r.diagnostics.length, 0);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("token-not-deprecated: deprecated token emits diagnostic", async () => {
    const dir = makeKBCwd("bridge-deprecated-fail-");
    try {
        const ruleset = makeRule("not-deprecated", {
            given: "$..tokens[*].name",
            then: { function: "token-not-deprecated" },
        });
        const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { tokens: [{ name: "$color/text/legacy/muted" }] }, { source: "x.cspec.yaml", cwd: dir });
        strict_1.default.equal(r.diagnostics.length, 1, JSON.stringify(r.diagnostics));
        strict_1.default.match(r.diagnostics[0].message, /deprecated/);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
// ---------------------------------------------------------------------------
// interaction-token-is-float
// ---------------------------------------------------------------------------
(0, node_test_1.test)("interaction-token-is-float: FLOAT interaction token passes", async () => {
    const dir = makeKBCwd("bridge-interaction-pass-");
    try {
        const ruleset = makeRule("interaction-float", {
            given: "$..tokens[*].name",
            then: { function: "interaction-token-is-float" },
        });
        const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { tokens: [{ name: "$interaction/hover" }] }, { source: "x.cspec.yaml", cwd: dir });
        strict_1.default.equal(r.diagnostics.length, 0, JSON.stringify(r.diagnostics));
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("interaction-token-is-float: COLOR-typed interaction token emits", async () => {
    const dir = makeKBCwd("bridge-interaction-fail-");
    try {
        const ruleset = makeRule("interaction-float", {
            given: "$..tokens[*].name",
            then: { function: "interaction-token-is-float" },
        });
        const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { tokens: [{ name: "$interaction/pressed-bad" }] }, { source: "x.cspec.yaml", cwd: dir });
        strict_1.default.equal(r.diagnostics.length, 1, JSON.stringify(r.diagnostics));
        strict_1.default.match(r.diagnostics[0].message, /expected FLOAT/);
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)("interaction-token-is-float: non-interaction token is ignored", async () => {
    const dir = makeKBCwd("bridge-interaction-skip-");
    try {
        const ruleset = makeRule("interaction-float", {
            given: "$..tokens[*].name",
            then: { function: "interaction-token-is-float" },
        });
        const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { tokens: [{ name: "$color/background/surface/subtle" }] }, { source: "x.cspec.yaml", cwd: dir });
        strict_1.default.equal(r.diagnostics.length, 0, JSON.stringify(r.diagnostics));
    }
    finally {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
});
// ---------------------------------------------------------------------------
// recipe-eligible
// ---------------------------------------------------------------------------
(0, node_test_1.test)("recipe-eligible: screen archetype with low corrections passes", async () => {
    const ruleset = makeRule("recipe", {
        given: "$",
        then: { function: "recipe-eligible" },
    });
    const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { archetype: "screen", meta: { corrections: 1 } }, { source: "x.cspec.yaml" });
    strict_1.default.equal(r.diagnostics.length, 0, JSON.stringify(r.diagnostics));
});
(0, node_test_1.test)("recipe-eligible: component archetype emits info", async () => {
    const ruleset = makeRule("recipe", {
        given: "$",
        then: { function: "recipe-eligible" },
        severity: "info",
    });
    const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { archetype: "component", meta: { corrections: 0 } }, { source: "x.cspec.yaml" });
    strict_1.default.equal(r.diagnostics.length, 1, JSON.stringify(r.diagnostics));
    strict_1.default.match(r.diagnostics[0].message, /archetype is "component"/);
});
(0, node_test_1.test)("recipe-eligible: high correction count emits info", async () => {
    const ruleset = makeRule("recipe", {
        given: "$",
        then: { function: "recipe-eligible" },
        severity: "info",
    });
    const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, { archetype: "screen", meta: { corrections: 5 } }, { source: "x.cspec.yaml" });
    strict_1.default.equal(r.diagnostics.length, 1, JSON.stringify(r.diagnostics));
    strict_1.default.match(r.diagnostics[0].message, /5 corrections recorded/);
});
// ---------------------------------------------------------------------------
// Smoke: factory wiring — deferred stub for ship-bundle-complete still loads
// ---------------------------------------------------------------------------
(0, node_test_1.test)("ship-bundle-complete deferred stub: loads without crashing, emits warning once", async () => {
    // Suppress the once-per-name warning the stub prints to stderr.
    const originalWarn = console.warn;
    let warnMessage;
    console.warn = (msg) => {
        warnMessage = msg;
    };
    try {
        const dir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), "bridge-deferred-wiring-"));
        (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        const ruleset = makeRule("deferred", {
            given: "$",
            then: { function: "ship-bundle-complete" },
            severity: "warn",
        });
        const r = await (0, engine_js_1.runRulesAgainstDocument)(ruleset, {}, { source: "x.yaml", cwd: dir });
        strict_1.default.equal(r.diagnostics.length, 0);
        strict_1.default.match(warnMessage ?? "", /deferred/);
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
    finally {
        console.warn = originalWarn;
    }
});
//# sourceMappingURL=builtin-functions.test.js.map