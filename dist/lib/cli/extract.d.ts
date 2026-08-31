export interface ExtractOptions {
    configPath?: string;
    output?: string;
}
export declare function extractHeadless(opts?: ExtractOptions): Promise<{
    variables: number;
    components: number;
    textStyles: number;
}>;
//# sourceMappingURL=extract.d.ts.map