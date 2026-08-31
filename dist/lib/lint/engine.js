"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRulesAgainstDocument = runRulesAgainstDocument;
// lib/lint/engine.ts
const spectral_core_1 = require("@stoplight/spectral-core");
const functions = __importStar(require("@stoplight/spectral-functions"));
const spectral_parsers_1 = require("@stoplight/spectral-parsers");
const builtin_functions_js_1 = require("./builtin-functions.js");
const SPECTRAL_SEVERITY = {
    off: -1,
    hint: 3,
    info: 2,
    warn: 1,
    error: 0,
};
// TODO(v7.1): generate a typed function registry from @stoplight/spectral-functions
// so RuleDef['then']['function'] can be a typed union (BuiltinFunctionId | (string & {})).
// Today we resolve dynamically via string name; unknown names throw.
const BUILTIN_FUNCTIONS = functions;
function resolveFunction(name, customFunctions, bridgeBuiltins) {
    // 1. Consumer-loaded custom functions (highest priority — let consumers
    //    override bridge built-ins and stoplight builtins if they need to).
    const custom = customFunctions.find((f) => f.name === name);
    if (custom)
        return custom.fn;
    // 2. Bridge built-in functions (real impls + remaining v7.0 stubs).
    //    Built per-invocation via `buildBridgeBuiltinFunctions(ctx)` so KB-bound
    //    functions can close over cwd/kbPath. Stubs still fail OPEN (warn once).
    const bridge = bridgeBuiltins[name];
    if (typeof bridge === "function") {
        return bridge;
    }
    // 3. Stoplight built-in functions (truthy, pattern, schema, ...).
    const fn = BUILTIN_FUNCTIONS[name];
    if (typeof fn !== "function") {
        throw new Error(`Unknown Spectral function "${name}". Built-in functions: ${Object.keys(BUILTIN_FUNCTIONS)
            .filter((k) => typeof BUILTIN_FUNCTIONS[k] === "function")
            .concat(Object.keys(bridgeBuiltins))
            .concat(customFunctions.map((f) => f.name))
            .join(", ")}.`);
    }
    return fn;
}
function toCategory(rule) {
    return rule.meta.category;
}
async function runRulesAgainstDocument(ruleset, document, opts) {
    const customFunctions = opts.customFunctions ?? [];
    // Built once per invocation so KB-bound functions (B-2 follow-up) can close
    // over per-cwd state without leaking globals. Lightweight today (5 closures
    // + 5 stubs); KB-loaders will memoize against `ctx.cwd`.
    const bridgeBuiltins = (0, builtin_functions_js_1.buildBridgeBuiltinFunctions)({
        cwd: opts.cwd ?? process.cwd(),
        kbPath: opts.kbPath,
    });
    // We serialize once and reuse the JSON string across per-rule Spectral
    // instances. Document is cheap to reconstruct and not safe to share across
    // Spectral.run() invocations.
    const serialized = JSON.stringify(document);
    const diagnostics = [];
    // Per-rule isolation. v7.0.1 ran all rules through one Spectral instance;
    // when a single rule's JSONPath crashed (typically nimma's filter expression
    // against an array containing null elements), the whole batch was lost and
    // the outer catch synthesized a misleading `lint-engine/parse-error`. v7.0.2
    // runs each rule in its own Spectral instance so a crash is contained to
    // that rule. ~50-100ms extra per doc on a 43-rule corpus — acceptable.
    for (const [id, rule] of Object.entries(ruleset.rules)) {
        // Filter `off` rules before handing to Spectral. Spectral's severity -1 is
        // undefined behavior — it may still execute rules. Skipping here is the
        // only safe way to disable a rule.
        if (rule.severity === "off")
            continue;
        const spectral = new spectral_core_1.Spectral();
        try {
            spectral.setRuleset({
                rules: {
                    [id]: {
                        description: rule.description,
                        // Spectral's default behavior is to use `rule.description` as the
                        // emitted message, dropping the function-provided message. We
                        // override with the `{{error}}` template so custom functions can
                        // communicate specifics (e.g. "French markers: ..., ..."). When a
                        // function returns no message, Spectral falls back to description.
                        message: "{{error}}",
                        given: rule.given,
                        then: {
                            ...(rule.then.field !== undefined ? { field: rule.then.field } : {}),
                            function: resolveFunction(rule.then.function, customFunctions, bridgeBuiltins),
                            functionOptions: rule.then.functionOptions,
                        },
                        severity: SPECTRAL_SEVERITY[rule.severity],
                    },
                },
            });
        }
        catch (err) {
            // Unknown function / malformed `then` — surface as a rule-crash so the
            // operator sees the offending rule name instead of a parse-error.
            diagnostics.push({
                ruleId: "lint-engine/rule-crash",
                severity: "warn",
                category: "structure",
                message: `Rule "${id}" failed to load: ${err instanceof Error ? err.message : String(err)}.`,
                path: [],
                source: opts.source,
            });
            continue;
        }
        const doc = new spectral_core_1.Document(serialized, spectral_parsers_1.Json, opts.source);
        let spectralResults;
        try {
            spectralResults = await spectral.run(doc);
        }
        catch (err) {
            // Most common cause: nimma JSONPath filter crashes when the targeted
            // array contains null elements (e.g. `[?(@.type == 'X')]` against
            // `[null, {...}]`). We emit a rule-specific warning rather than killing
            // the whole batch.
            diagnostics.push({
                ruleId: "lint-engine/rule-crash",
                severity: "warn",
                category: "structure",
                message: `Rule "${id}" crashed during evaluation: ${err instanceof Error ? err.message : String(err)}. The rule is likely using a JSONPath filter that doesn't handle null elements — consider tightening with [?(@ && @.field == ...)].`,
                path: [],
                source: opts.source,
            });
            continue;
        }
        for (const r of spectralResults) {
            const ruleId = r.code ?? id;
            diagnostics.push({
                ruleId,
                severity: rule.severity,
                category: toCategory(rule),
                message: r.message,
                path: r.path,
                source: opts.source,
            });
        }
    }
    const total = Object.keys(ruleset.rules).length;
    const failed = new Set(diagnostics.map((d) => d.ruleId)).size;
    return {
        diagnostics,
        coverage: {
            byCategory: {}, // computed later in coverage.ts
            overall: { passed: total - failed, failed, total },
        },
    };
}
//# sourceMappingURL=engine.js.map