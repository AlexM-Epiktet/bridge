import type { RuleDef } from "./types.js";
interface RenderOpts {
    readonly rules: Record<string, RuleDef>;
    readonly request: {
        readonly archetype?: string;
    };
    readonly maxRules?: number;
}
export declare function renderSkillOverlay(opts: RenderOpts): string;
export {};
//# sourceMappingURL=overlay.d.ts.map