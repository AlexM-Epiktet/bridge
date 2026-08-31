export type Transport = "console" | "official";
/**
 * Wrap code for the console transport (figma_execute).
 */
export declare function wrapConsole(code: string, fontCode: string): string;
/**
 * Wrap code for the official transport (use_figma).
 * Strips figma.notify() calls and enforces the 20KB limit.
 */
export declare function wrapOfficial(code: string, fontCode: string, fileKey: string | null | undefined, _description?: string): string;
export interface WrapChunkDescriptor {
    label: string;
}
/**
 * Wrap a single chunk for execution.
 * For multi-chunk build chunks (non-preload), prepends globalThis destructuring.
 */
export declare function wrapChunk(code: string, chunk: WrapChunkDescriptor, transport: Transport, fileKey?: string | null): string;
//# sourceMappingURL=wrap.d.ts.map