"use strict";
// ---------------------------------------------------------------------------
// plan.ts — Chunking planner, splits a resolved graph into executable chunks
// ---------------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILD_TARGET = exports.MAX_IMPORTS = exports.MAX_CHUNK_SIZE = void 0;
exports.plan = plan;
exports.MAX_CHUNK_SIZE = 12000; // chars of generated code (before wrapping)
exports.MAX_IMPORTS = 30; // variable/component/style imports per chunk
exports.BUILD_TARGET = 3000; // target chars per build chunk
const CHARS_PER_NODE = 500; // rough estimate: 10 lines × 50 chars
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function countImports(imports) {
    const v = imports.variables?.length ?? 0;
    const c = imports.components?.length ?? 0;
    const s = imports.textStyles?.length ?? 0;
    return v + c + s;
}
/**
 * Rough code-size estimate for a set of nodes (recursive count).
 * NOTE: preserves the exact arithmetic of the pre-migration JS implementation.
 */
function estimateNodeSize(nodes) {
    let count = 0;
    for (const node of nodes) {
        count += 1;
        const children = node.children;
        if (children && children.length) {
            count += estimateNodeSize(children);
        }
    }
    return count * CHARS_PER_NODE;
}
// ---------------------------------------------------------------------------
// Single-chunk plan
// ---------------------------------------------------------------------------
function singleChunkPlan(nodes, imports, estimatedSize) {
    const total = countImports(imports);
    const chunk = {
        index: 0,
        label: "build-0",
        imports: {
            variables: (imports.variables ?? []).slice(),
            components: (imports.components ?? []).slice(),
            textStyles: (imports.textStyles ?? []).slice(),
        },
        nodes: nodes.slice(),
        bridgeExports: [],
        bridgeImports: [],
    };
    return { chunks: [chunk], totalImports: total, estimatedCodeSize: estimatedSize };
}
// ---------------------------------------------------------------------------
// Multi-chunk plan
// ---------------------------------------------------------------------------
function multiChunkPlan(nodes, imports, estimatedSize, _options) {
    const total = countImports(imports);
    // Names exported from preload (all imports + "root")
    const exportNames = [];
    const vars = imports.variables ?? [];
    const comps = imports.components ?? [];
    const styles = imports.textStyles ?? [];
    for (const v of vars) {
        exportNames.push(v.localName ?? v.name);
    }
    for (const c of comps) {
        exportNames.push(c.localName ?? c.name);
    }
    for (const s of styles) {
        exportNames.push(s.localName ?? s.name);
    }
    exportNames.push("root");
    // Chunk 0: preload
    const preload = {
        index: 0,
        label: "preload",
        imports: {
            variables: vars.slice(),
            components: comps.slice(),
            textStyles: styles.slice(),
        },
        nodes: [],
        bridgeExports: exportNames.slice(),
        bridgeImports: [],
    };
    // Build chunks: group top-level children by estimated size
    const buildChunks = [];
    let currentNodes = [];
    let currentSize = 0;
    for (const node of nodes) {
        const nodeSize = estimateNodeSize([node]);
        if (currentNodes.length > 0 && currentSize + nodeSize > exports.BUILD_TARGET) {
            buildChunks.push(currentNodes);
            currentNodes = [];
            currentSize = 0;
        }
        currentNodes.push(node);
        currentSize += nodeSize;
    }
    if (currentNodes.length > 0) {
        buildChunks.push(currentNodes);
    }
    if (buildChunks.length === 0) {
        buildChunks.push([]);
    }
    const chunks = [preload];
    for (let i = 0; i < buildChunks.length; i++) {
        chunks.push({
            index: i + 1,
            label: "build-" + i,
            imports: { variables: [], components: [], textStyles: [] },
            nodes: buildChunks[i],
            bridgeExports: [],
            bridgeImports: exportNames.slice(),
        });
    }
    return { chunks, totalImports: total, estimatedCodeSize: estimatedSize };
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Plan how to split a resolved graph into executable chunks.
 */
function plan(resolvedGraph, imports, options) {
    const opts = options ?? {};
    const maxChunk = opts.maxChunkSize ?? exports.MAX_CHUNK_SIZE;
    const nodes = resolvedGraph?.nodes ?? [];
    const safeImports = imports ?? { variables: [], components: [], textStyles: [] };
    const estimatedSize = estimateNodeSize(nodes);
    const totalImports = countImports(safeImports);
    if (estimatedSize < maxChunk && totalImports < exports.MAX_IMPORTS) {
        return singleChunkPlan(nodes, safeImports, estimatedSize);
    }
    return multiChunkPlan(nodes, safeImports, estimatedSize, opts);
}
//# sourceMappingURL=plan.js.map