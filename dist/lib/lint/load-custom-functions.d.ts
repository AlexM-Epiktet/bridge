export type LoadedFunction = {
    name: string;
    fn: (...args: unknown[]) => unknown;
};
export declare function loadCustomFunctions(functionsDir: string | undefined): Promise<LoadedFunction[]>;
//# sourceMappingURL=load-custom-functions.d.ts.map