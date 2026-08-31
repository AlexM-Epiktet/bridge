export interface MigrateOptions {
    kbPath: string;
}
export interface MigrateResult {
    migrated: boolean;
    from: "legacy-grouped" | "current";
    to: number;
}
export declare function migrate(opts: MigrateOptions): Promise<MigrateResult>;
//# sourceMappingURL=migrate.d.ts.map