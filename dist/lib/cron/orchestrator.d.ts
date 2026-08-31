export interface CronOptions {
    configPath: string;
}
interface RegistryWrite {
    registry: string;
    fileKey: string;
    /** Entries carried over from the previous file rather than from Figma. */
    preserved?: number;
}
interface RegistrySkip {
    registry: string;
    reason: string;
}
/**
 * Merge a fresh REST extraction over the existing `components.json`, keeping
 * entries the extraction cannot possibly know about.
 *
 * Two classes of entry survive a refresh:
 *
 * - **`source: "local"`** — components Bridge created in the Figma file but
 *   which are not published as library components, so `/components` never
 *   returns them. Overwriting would erase a component the user just made.
 * - **entries carrying an `angular` binding** — the Figma↔code mapping is
 *   maintained by hand (or by a rebind pass) and has no REST counterpart. The
 *   REST entry wins for everything else, but the binding is grafted back on.
 *
 * A local entry whose key later shows up in the REST result is dropped in
 * favour of the published one: publication is the promotion path, and keeping
 * both would leave two entries resolving to the same component.
 */
export declare function mergeLocalComponents(file: string, fresh: {
    components: unknown[];
}): Promise<{
    registry: Record<string, unknown>;
    preserved: number;
}>;
export declare function runCron(opts: CronOptions): Promise<{
    extracted: boolean;
    dsName: string;
    writes: RegistryWrite[];
    skips: RegistrySkip[];
}>;
export {};
//# sourceMappingURL=orchestrator.d.ts.map