import { z } from "zod";
export declare const KBConfigSchema: z.ZodObject<{
    dsName: z.ZodString;
    tagline: z.ZodOptional<z.ZodString>;
    figmaFileKey: z.ZodString;
    figmaFiles: z.ZodDefault<z.ZodObject<{
        components: z.ZodOptional<z.ZodString>;
        variables: z.ZodOptional<z.ZodString>;
        textStyles: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        components?: string | undefined;
        variables?: string | undefined;
        textStyles?: string | undefined;
    }, {
        components?: string | undefined;
        variables?: string | undefined;
        textStyles?: string | undefined;
    }>>;
    kbPath: z.ZodDefault<z.ZodString>;
    cron: z.ZodDefault<z.ZodObject<{
        cadence: z.ZodDefault<z.ZodString>;
        time: z.ZodDefault<z.ZodString>;
        maxPRsPerWeek: z.ZodDefault<z.ZodNumber>;
        autoMergeIfTrivial: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        cadence: string;
        time: string;
        maxPRsPerWeek: number;
        autoMergeIfTrivial: boolean;
    }, {
        cadence?: string | undefined;
        time?: string | undefined;
        maxPRsPerWeek?: number | undefined;
        autoMergeIfTrivial?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    dsName: string;
    figmaFileKey: string;
    figmaFiles: {
        components?: string | undefined;
        variables?: string | undefined;
        textStyles?: string | undefined;
    };
    kbPath: string;
    cron: {
        cadence: string;
        time: string;
        maxPRsPerWeek: number;
        autoMergeIfTrivial: boolean;
    };
    tagline?: string | undefined;
}, {
    dsName: string;
    figmaFileKey: string;
    tagline?: string | undefined;
    figmaFiles?: {
        components?: string | undefined;
        variables?: string | undefined;
        textStyles?: string | undefined;
    } | undefined;
    kbPath?: string | undefined;
    cron?: {
        cadence?: string | undefined;
        time?: string | undefined;
        maxPRsPerWeek?: number | undefined;
        autoMergeIfTrivial?: boolean | undefined;
    } | undefined;
}>;
export type KBConfig = z.infer<typeof KBConfigSchema>;
export type RegistryCategory = "components" | "variables" | "textStyles";
export declare function resolveFileKey(cfg: KBConfig, category: RegistryCategory): string;
export declare function parseKBConfig(raw: string): KBConfig;
//# sourceMappingURL=kb-config.d.ts.map