/** Snapshot of one registry (e.g. `components.json`) at baseline time. */
export interface RegistryBaseline {
    /** sha256 over the normalised entry-hash map — envelope excluded. */
    hash: string;
    entryCount: number;
    /** Stable entry id (usually the Figma `key`) → hash of that entry. */
    entryHashes: Record<string, string>;
    capturedAt: string;
}
export interface KBBaseline {
    version: 1;
    /** Registry file name (`"components.json"`) → its baseline. */
    baselines: Record<string, RegistryBaseline>;
}
export interface RegistryDiff {
    /** `"new"` means there was no baseline to compare against yet. */
    status: "unchanged" | "changed" | "new";
    /** Entry ids present now but absent from the baseline. */
    added: string[];
    /** Entry ids present in the baseline but absent now. */
    removed: string[];
    /** Entry ids present in both whose content hash differs. */
    modified: string[];
}
/** Where the baseline lives, relative to the KB root. Kept under `.bridge/`
 * alongside the cron sync report so KB payload directories stay clean. */
export declare function baselinePath(kbPath: string): string;
/**
 * Hash each registry entry individually and derive one aggregate hash.
 *
 * The aggregate is computed over the entry-hash *map*, not the entry array,
 * so it is insensitive to the order Figma happens to return entries in — the
 * REST API gives no ordering guarantee and a reshuffle is not drift.
 *
 * @param entries the registry payload array (`components`, `variables`, …)
 * @param idField field that identifies an entry across runs (default `"key"`)
 */
export declare function hashRegistryEntries(entries: readonly Record<string, unknown>[], idField?: string): {
    hash: string;
    entryHashes: Record<string, string>;
};
/** Read the baseline, or `null` when the KB has never been baselined. */
export declare function readBaseline(kbPath: string): Promise<KBBaseline | null>;
export declare function writeBaseline(kbPath: string, baseline: KBBaseline): Promise<void>;
/**
 * Classify the change between a stored baseline and a freshly computed hash
 * set. With no baseline the status is `"new"` and the id lists stay empty —
 * listing every entry as "added" on a first run would be noise, not signal.
 */
export declare function diffRegistry(previous: RegistryBaseline | undefined, current: {
    hash: string;
    entryHashes: Record<string, string>;
}): RegistryDiff;
//# sourceMappingURL=baseline.d.ts.map