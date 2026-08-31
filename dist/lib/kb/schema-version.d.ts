export declare const CURRENT_KB_SCHEMA_VERSION = 1;
export type KBSchemaErrorKind = "legacy-grouped" | "newer" | "corrupt" | "missing";
export declare class KBSchemaError extends Error {
    readonly kind: KBSchemaErrorKind;
    constructor(message: string, kind: KBSchemaErrorKind);
}
export declare function readKBSchemaVersion(kbPath: string): number | null;
export declare function assertKBCompatible(kbPath: string): void;
//# sourceMappingURL=schema-version.d.ts.map