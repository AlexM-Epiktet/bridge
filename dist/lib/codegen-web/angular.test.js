"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const angular_js_1 = require("./angular.js");
const token_refs_js_1 = require("./token-refs.js");
// ─── Fixtures ────────────────────────────────────────────────────────────────
function valueIndex(variables, theme) {
    const themeByName = new Map();
    const themeByKey = new Map();
    for (const t of theme) {
        if (t.figmaName)
            themeByName.set(t.figmaName, t);
        if (t.figmaKey)
            themeByKey.set(t.figmaKey, t);
    }
    return {
        variables,
        variableByName: new Map(variables.map((v) => [v.name, v])),
        variableByKey: new Map(variables.map((v) => [v.key, v])),
        textStyles: [],
        textStyleByName: new Map(),
        textStyleByKey: new Map(),
        themeByName,
        themeByKey,
        themeCssFile: null,
        modes: ["light"],
        defaultMode: "light",
        warnings: [],
    };
}
/** A KB shaped like the real one: colours bound by lockfile, spacing by name. */
const refs = (0, token_refs_js_1.buildTokenRefs)(valueIndex([
    { key: "KP", name: "main/color/primary/primary", resolvedType: "COLOR", valuesByMode: {} },
    { key: "KB1", name: "main/color/base/100", resolvedType: "COLOR", valuesByMode: {} },
    { key: "KBC", name: "main/color/base/content", resolvedType: "COLOR", valuesByMode: {} },
    { key: "KR", name: "radius/boxes", resolvedType: "FLOAT", valuesByMode: {} },
    { key: "KS4", name: "tailwind/spacing/4 (16)", resolvedType: "FLOAT", valuesByMode: {} },
    { key: "KS6", name: "tailwind/spacing/6 (24)", resolvedType: "FLOAT", valuesByMode: {} },
    { key: "KSEM", name: "space/form/field-gap", resolvedType: "FLOAT", valuesByMode: {} },
], [
    {
        cssVar: "--color-primary",
        figmaKey: "KP",
        figmaName: "main/color/primary/primary",
        cssValue: "oklch(52% .2 268)",
    },
    {
        cssVar: "--color-base-100",
        figmaKey: "KB1",
        figmaName: "main/color/base/100",
        cssValue: "oklch(98% 0 0)",
    },
    {
        cssVar: "--color-base-content",
        figmaKey: "KBC",
        figmaName: "main/color/base/content",
        cssValue: "oklch(27% 0 0)",
    },
    { cssVar: "--radius-box", figmaKey: "KR", figmaName: "radius/boxes", cssValue: "0.5rem" },
]));
/** Resolved tokens as they appear on a graph after the resolve stage. */
const tk = (key, name) => ({
    ref: `$${name}`,
    key,
    name,
    kind: "variable",
    importMethod: null,
});
const bindings = {
    byName: new Map([
        [
            "am-input-field",
            {
                selector: "am-input-field",
                lib: "@amelis/foundation/web-ui",
                sourcePath: null,
                kind: "component",
            },
        ],
    ]),
    byKey: new Map(),
    unusable: [],
};
function graph(nodes) {
    return { version: "3.0", metadata: { name: "Card", width: 400, height: 300 }, fonts: [], nodes };
}
function emit(nodes, opts = {}) {
    return (0, angular_js_1.emitAngularComponent)(graph(nodes), refs, {
        name: "user-card",
        bindings,
        baseClass: { name: "BaseComponent", importPath: "@amelis/foundation/base" },
        ...opts,
    });
}
function fileNamed(result, suffix) {
    return result.files.find((f) => f.path.endsWith(suffix)).content;
}
// ─── Naming ──────────────────────────────────────────────────────────────────
(0, node_test_1.test)("names follow the house convention", () => {
    strict_1.default.equal((0, angular_js_1.toKebabCase)("UserCard"), "user-card");
    strict_1.default.equal((0, angular_js_1.toKebabCase)("user card"), "user-card");
    strict_1.default.equal((0, angular_js_1.toPascalCase)("user-card"), "UserCard");
});
// ─── Layout ──────────────────────────────────────────────────────────────────
(0, node_test_1.test)("auto-layout becomes flex utilities on the host element", () => {
    const result = emit([
        {
            type: "FRAME",
            name: "Root",
            layout: "VERTICAL",
            primaryAxisAlign: "SPACE_BETWEEN",
            counterAxisAlign: "CENTER",
            gap: tk("KS4", "tailwind/spacing/4 (16)"),
            fill: tk("KB1", "main/color/base/100"),
            radius: tk("KR", "radius/boxes"),
            children: [],
        },
    ]);
    const ts = fileNamed(result, ".component.ts");
    strict_1.default.match(ts, /host: \{ class: '[^']*flex flex-col[^']*' \}/);
    strict_1.default.match(ts, /justify-between/);
    strict_1.default.match(ts, /items-center/);
    strict_1.default.match(ts, /gap-4/);
    strict_1.default.match(ts, /bg-base-100/);
    strict_1.default.match(ts, /rounded-box/);
});
(0, node_test_1.test)("uniform padding collapses to a single utility, split padding to axes", () => {
    const uniform = emit([
        {
            type: "FRAME",
            name: "Root",
            layout: "VERTICAL",
            paddingTop: tk("KS4", "tailwind/spacing/4 (16)"),
            paddingRight: tk("KS4", "tailwind/spacing/4 (16)"),
            paddingBottom: tk("KS4", "tailwind/spacing/4 (16)"),
            paddingLeft: tk("KS4", "tailwind/spacing/4 (16)"),
            children: [],
        },
    ]);
    strict_1.default.match(fileNamed(uniform, ".component.ts"), /\bp-4\b/);
    const axes = emit([
        {
            type: "FRAME",
            name: "Root",
            layout: "VERTICAL",
            paddingTop: tk("KS6", "tailwind/spacing/6 (24)"),
            paddingBottom: tk("KS6", "tailwind/spacing/6 (24)"),
            paddingRight: tk("KS4", "tailwind/spacing/4 (16)"),
            paddingLeft: tk("KS4", "tailwind/spacing/4 (16)"),
            children: [],
        },
    ]);
    const ts = fileNamed(axes, ".component.ts");
    strict_1.default.match(ts, /py-6/);
    strict_1.default.match(ts, /px-4/);
});
// ─── The refusal discipline ──────────────────────────────────────────────────
(0, node_test_1.test)("a semantic spacing token with no utility mapping is flagged, not approximated", () => {
    const result = emit([
        {
            type: "FRAME",
            name: "Root",
            layout: "VERTICAL",
            gap: tk("KSEM", "space/form/field-gap"),
            children: [],
        },
    ]);
    strict_1.default.equal(result.flags.length, 1);
    strict_1.default.equal(result.flags[0]?.role, "gap");
    strict_1.default.equal(result.flags[0]?.token, "space/form/field-gap");
    strict_1.default.match(result.flags[0].reason, /no Tailwind spacing step/);
    // Nothing invented in its place.
    strict_1.default.doesNotMatch(fileNamed(result, ".component.ts"), /gap-/);
});
(0, node_test_1.test)("an unmapped component becomes a marked gap, never an invented element", () => {
    const result = emit([
        {
            type: "FRAME",
            name: "Root",
            layout: "VERTICAL",
            children: [
                {
                    type: "INSTANCE",
                    name: "Widget",
                    component: "$comp/am-mystery-widget",
                    _resolvedComponent: {
                        ref: "$comp/am-mystery-widget",
                        key: "KX",
                        name: "am-mystery-widget",
                        kind: "component",
                        importMethod: null,
                    },
                },
            ],
        },
    ]);
    const html = fileNamed(result, ".component.html");
    strict_1.default.match(html, /<!-- bridge: unmapped component "am-mystery-widget" -->/);
    strict_1.default.ok(result.flags.some((f) => f.reason.includes("no Angular binding")));
});
// ─── Instances ───────────────────────────────────────────────────────────────
(0, node_test_1.test)("a bound component becomes its real selector and is imported once", () => {
    const result = emit([
        {
            type: "FRAME",
            name: "Root",
            layout: "VERTICAL",
            children: [
                {
                    type: "INSTANCE",
                    name: "Name",
                    component: "$comp/am-input-field",
                    _resolvedComponent: {
                        ref: "$comp/am-input-field",
                        key: "KI",
                        name: "am-input-field",
                        kind: "component",
                        importMethod: null,
                    },
                    properties: { label: "Nom" },
                },
            ],
        },
    ]);
    strict_1.default.match(fileNamed(result, ".component.html"), /<am-input-field label="Nom" \/>/);
    const ts = fileNamed(result, ".component.ts");
    strict_1.default.match(ts, /import \{ AmInputField \} from '@amelis\/foundation\/web-ui';/);
    strict_1.default.match(ts, /imports: \[AmInputField\]/);
});
(0, node_test_1.test)("a framework primitive becomes a native element with modifier classes", () => {
    const result = emit([
        {
            type: "FRAME",
            name: "Root",
            layout: "VERTICAL",
            children: [
                {
                    type: "INSTANCE",
                    name: "Submit",
                    component: "$comp/Button",
                    _resolvedComponent: {
                        ref: "$comp/Button",
                        key: "KBTN",
                        name: "Button",
                        kind: "component",
                        importMethod: null,
                    },
                    variant: { color: "primary", size: "sm" },
                    properties: { label: "Envoyer" },
                },
            ],
        },
    ]);
    strict_1.default.match(fileNamed(result, ".component.html"), /<button class="btn btn-primary btn-sm">Envoyer<\/button>/);
    strict_1.default.equal(result.flags.length, 0);
});
(0, node_test_1.test)("decorative prefixes on real variant axes and properties are normalised", () => {
    const result = emit([
        {
            type: "FRAME",
            name: "Root",
            layout: "VERTICAL",
            children: [
                {
                    type: "INSTANCE",
                    name: "Voir",
                    component: "$comp/Button",
                    _resolvedComponent: {
                        ref: "$comp/Button",
                        key: "KBTN",
                        name: "Button",
                        kind: "component",
                        importMethod: null,
                    },
                    // Exactly the shape a published Figma library produces.
                    variant: { "🎨 color": "primary", "📐 size": "sm", "🌟 style": "default" },
                    properties: { "↪ ✏️ label#6519:0": "Voir la fiche" },
                },
            ],
        },
    ]);
    const html = fileNamed(result, ".component.html");
    // The label comes from the property, not from the layer name.
    strict_1.default.match(html, />Voir la fiche</);
    strict_1.default.match(html, /class="btn btn-primary btn-sm"/);
    // "default" is the framework's unmodified state and must not become a class.
    strict_1.default.doesNotMatch(html, /btn-default/);
});
(0, node_test_1.test)("a bound component's attributes use normalised property names", () => {
    const result = emit([
        {
            type: "FRAME",
            name: "Root",
            layout: "VERTICAL",
            children: [
                {
                    type: "INSTANCE",
                    name: "Nom",
                    component: "$comp/am-input-field",
                    _resolvedComponent: {
                        ref: "$comp/am-input-field",
                        key: "KI",
                        name: "am-input-field",
                        kind: "component",
                        importMethod: null,
                    },
                    properties: { "↪ ✏️ label#42:0": "Nom" },
                },
            ],
        },
    ]);
    strict_1.default.match(fileNamed(result, ".component.html"), /<am-input-field label="Nom" \/>/);
});
// ─── Text ────────────────────────────────────────────────────────────────────
(0, node_test_1.test)("typography utilities are read from the text style name", () => {
    const result = emit([
        {
            type: "FRAME",
            name: "Root",
            layout: "VERTICAL",
            children: [
                {
                    type: "TEXT",
                    name: "Title",
                    characters: "Bonjour",
                    textStyle: {
                        ref: "$text/tailwind/sans/3xl/semibold",
                        key: "TS",
                        name: "🌀 tailwind/sans/3xl/semibold",
                        kind: "textStyle",
                        importMethod: null,
                    },
                    fill: tk("KBC", "main/color/base/content"),
                },
            ],
        },
    ]);
    const html = fileNamed(result, ".component.html");
    // Figma names the weight "semiBold"; the utility class is lower-case.
    strict_1.default.match(html, /class="text-3xl font-semibold text-base-content"/);
    strict_1.default.match(html, />Bonjour</);
});
(0, node_test_1.test)("a decorated text style name still yields typography utilities", () => {
    const result = emit([
        {
            type: "FRAME",
            name: "Root",
            layout: "VERTICAL",
            children: [
                {
                    type: "TEXT",
                    name: "T",
                    characters: "x",
                    textStyle: {
                        ref: "$text/sans/lg",
                        key: "TS3",
                        name: "🌀 tailwind/sans/lg/normal",
                        kind: "textStyle",
                        importMethod: null,
                    },
                },
            ],
        },
    ]);
    const html = fileNamed(result, ".component.html");
    strict_1.default.match(html, /class="text-lg"/);
    // "normal" is the default weight and adds no class.
    strict_1.default.doesNotMatch(html, /font-normal/);
    strict_1.default.equal(result.flags.length, 0);
});
(0, node_test_1.test)("a text style outside the tailwind namespace is flagged rather than guessed", () => {
    const result = emit([
        {
            type: "FRAME",
            name: "Root",
            layout: "VERTICAL",
            children: [
                {
                    type: "TEXT",
                    name: "Title",
                    characters: "Hi",
                    textStyle: {
                        ref: "$text/heading/xl",
                        key: "TS2",
                        name: "heading/xl",
                        kind: "textStyle",
                        importMethod: null,
                    },
                },
            ],
        },
    ]);
    strict_1.default.ok(result.flags.some((f) => f.reason.includes("not in the tailwind/* namespace")));
});
(0, node_test_1.test)("text content is escaped", () => {
    const result = emit([
        {
            type: "FRAME",
            name: "Root",
            layout: "VERTICAL",
            children: [{ type: "TEXT", name: "T", characters: "a < b & c" }],
        },
    ]);
    strict_1.default.match(fileNamed(result, ".component.html"), /a &lt; b &amp; c/);
});
// ─── Component API ───────────────────────────────────────────────────────────
(0, node_test_1.test)("a component set exposes its axes and properties as typed signal inputs", () => {
    const result = emit([
        {
            type: "COMPONENT_SET",
            name: "Button",
            variantProperties: [
                { name: "variant", values: ["primary", "secondary"], default: "primary" },
                { name: "size", values: ["sm", "md"] },
            ],
            componentProperties: [
                { name: "label", type: "TEXT", default: "Click" },
                { name: "showIcon", type: "BOOLEAN", default: false },
            ],
            children: [],
        },
    ]);
    const ts = fileNamed(result, ".component.ts");
    strict_1.default.match(ts, /public readonly variant: InputSignal<'primary' \| 'secondary'> = input<'primary' \| 'secondary'>\('primary'\);/);
    strict_1.default.match(ts, /public readonly size: InputSignal<'sm' \| 'md'> = input<'sm' \| 'md'>\('sm'\);/);
    strict_1.default.match(ts, /public readonly label: InputSignal<string> = input<string>\('Click'\);/);
    strict_1.default.match(ts, /public readonly showIcon: InputSignal<boolean> = input<boolean>\(false\);/);
    // With no variants there is nothing to wire, and that is stated rather than
    // left ambiguous.
    strict_1.default.ok(result.notes.some((n) => n.includes("nothing needed wiring")));
});
// ─── Variant wiring ──────────────────────────────────────────────────────────
/** A two-axis set whose variants differ only in the root's background. */
function buttonSet() {
    const variant = (color, size, fillKey, fillName) => ({
        type: "COMPONENT",
        name: `${color}/${size}`,
        variantValues: { color, size },
        layout: "HORIZONTAL",
        fill: tk(fillKey, fillName),
        radius: tk("KR", "radius/boxes"),
        children: [
            {
                type: "TEXT",
                name: "Label",
                characters: "Envoyer",
                textStyle: {
                    ref: "$text/sans/sm",
                    key: "TS",
                    name: "🌀 tailwind/sans/sm/normal",
                    kind: "textStyle",
                    importMethod: null,
                },
            },
        ],
    });
    return {
        type: "COMPONENT_SET",
        name: "Button",
        variantProperties: [
            { name: "color", values: ["primary", "base"], default: "primary" },
            { name: "size", values: ["sm"] },
        ],
        children: [
            variant("primary", "sm", "KP", "main/color/primary/primary"),
            variant("base", "sm", "KB1", "main/color/base/100"),
        ],
    };
}
(0, node_test_1.test)("a component set renders one variant, not every variant side by side", () => {
    const result = emit([buttonSet()]);
    const html = fileNamed(result, ".component.html");
    // One Label, from the default variant — not one per variant.
    strict_1.default.equal((html.match(/Envoyer/g) ?? []).length, 1);
});
(0, node_test_1.test)("classes that differ across variants move to a lookup table and a computed", () => {
    const result = emit([buttonSet()]);
    const ts = fileNamed(result, ".component.ts");
    // The differing class is tabulated per variant combination...
    strict_1.default.match(ts, /const ROOT_VARIANT_CLASSES: Record<string, string> = \{/);
    strict_1.default.match(ts, /'primary\|sm': 'bg-primary',/);
    strict_1.default.match(ts, /'base\|sm': 'bg-base-100',/);
    // ...selected by a computed keyed on the axis inputs...
    strict_1.default.match(ts, /protected readonly rootVariantClasses: Signal<string> = computed\(/);
    strict_1.default.match(ts, /ROOT_VARIANT_CLASSES\[`\$\{this\.color\(\)\}\|\$\{this\.size\(\)\}`\] \?\? ''/);
    // ...and bound on the host alongside the classes every variant shares.
    strict_1.default.match(ts, /host: \{ class: '[^']*rounded-box[^']*', '\[class\]': 'rootVariantClasses\(\)' \}/);
    // The variant-dependent class must not also be hardcoded in the static half.
    strict_1.default.doesNotMatch(ts, /host: \{ class: '[^']*bg-primary/);
    strict_1.default.match(ts, /import \{ ChangeDetectionStrategy, Component, InputSignal, Signal, computed, input \}/);
});
/** The body of a generated lookup table, so assertions do not span the file. */
function tableBody(ts, constName) {
    const match = new RegExp(`const ${constName}: Record<string, string> = \\{([\\s\\S]*?)\\n\\};`).exec(ts);
    strict_1.default.ok(match, `expected a ${constName} table`);
    return match[1];
}
(0, node_test_1.test)("classes shared by every variant stay static", () => {
    const ts = fileNamed(emit([buttonSet()]), ".component.ts");
    // radius is identical across variants, so it never enters the table...
    strict_1.default.doesNotMatch(tableBody(ts, "ROOT_VARIANT_CLASSES"), /rounded-box/);
    // ...it stays on the host instead.
    strict_1.default.match(ts, /host: \{ class: '[^']*rounded-box/);
});
(0, node_test_1.test)("a child node that differs across variants is wired on the element", () => {
    const set = buttonSet();
    const labelOf = (i) => set.children[i].children[0];
    // Both labels share a colour but differ in typography, so the split is visible.
    labelOf(0).fill = tk("KBC", "main/color/base/content");
    labelOf(1).fill = tk("KBC", "main/color/base/content");
    labelOf(1).textStyle = {
        ref: "$text/sans/lg",
        key: "TS2",
        name: "🌀 tailwind/sans/lg/bold",
        kind: "textStyle",
        importMethod: null,
    };
    const result = emit([set]);
    const html = fileNamed(result, ".component.html");
    const ts = fileNamed(result, ".component.ts");
    // Shared colour stays declarative; the typography that changes is bound.
    strict_1.default.match(html, /<span class="text-base-content" \[class\]="variantClasses1\(\)"/);
    const body = tableBody(ts, "VARIANT_CLASSES_1");
    // Class order follows the source, not the diff, so the table reads naturally.
    strict_1.default.match(body, /'primary\|sm': 'text-sm',/);
    strict_1.default.match(body, /'base\|sm': 'text-lg font-bold',/);
    strict_1.default.doesNotMatch(body, /text-base-content/);
});
(0, node_test_1.test)("a node with no shared classes is bound without an empty class attribute", () => {
    const set = buttonSet();
    set.children[1].children[0].textStyle = {
        ref: "$text/sans/lg",
        key: "TS2",
        name: "🌀 tailwind/sans/lg/bold",
        kind: "textStyle",
        importMethod: null,
    };
    const html = fileNamed(emit([set]), ".component.html");
    strict_1.default.match(html, /<span \[class\]="variantClasses1\(\)">/);
    strict_1.default.doesNotMatch(html, /class=""/);
});
(0, node_test_1.test)("variants with mismatched structure are reported rather than mis-wired", () => {
    const set = buttonSet();
    // Second variant loses its label, so positions no longer correspond.
    set.children[1].children = [];
    const result = emit([set]);
    strict_1.default.ok(result.notes.some((n) => n.includes("different structure from the first variant")));
});
(0, node_test_1.test)("the default variant seeds the template regardless of authoring order", () => {
    const set = buttonSet();
    set.children.reverse(); // "base" now comes first; "primary" is still the default
    const ts = fileNamed(emit([set]), ".component.ts");
    // The static host keeps the shared classes; the default's own fill is in the
    // table, so ordering must not change which variant the template came from.
    strict_1.default.match(ts, /'primary\|sm': 'bg-primary',/);
});
// ─── House style ─────────────────────────────────────────────────────────────
(0, node_test_1.test)("the class file follows the house conventions", () => {
    const ts = fileNamed(emit([{ type: "FRAME", name: "Root", layout: "VERTICAL", children: [] }]), ".component.ts");
    strict_1.default.match(ts, /selector: 'am-user-card',/);
    strict_1.default.match(ts, /export class AmUserCard extends BaseComponent \{\}/);
    strict_1.default.match(ts, /changeDetection: ChangeDetectionStrategy\.OnPush,/);
    strict_1.default.match(ts, /templateUrl: '\.\/user-card\.component\.html',/);
    // standalone is the default in modern Angular and must not be restated.
    strict_1.default.doesNotMatch(ts, /standalone/);
    // Tab indentation, single quotes.
    strict_1.default.match(ts, /\n\tselector:/);
});
(0, node_test_1.test)("files are colocated in a folder named after the component", () => {
    const result = emit([{ type: "FRAME", name: "Root", layout: "VERTICAL", children: [] }]);
    strict_1.default.deepEqual(result.files.map((f) => f.path).sort(), [
        "user-card/user-card.component.html",
        "user-card/user-card.component.stories.ts",
        "user-card/user-card.component.ts",
    ]);
});
(0, node_test_1.test)("the story is CSF3 with args covering every input", () => {
    const result = emit([
        {
            type: "COMPONENT_SET",
            name: "Button",
            variantProperties: [{ name: "variant", values: ["primary"], default: "primary" }],
            children: [],
        },
    ]);
    const story = fileNamed(result, ".stories.ts");
    strict_1.default.match(story, /const meta: Meta<AmUserCard> = \{/);
    strict_1.default.match(story, /provideZonelessChangeDetection\(\)/);
    strict_1.default.match(story, /variant: 'primary',/);
});
(0, node_test_1.test)("doc comments follow the requested language", () => {
    const fr = fileNamed(emit([{ type: "FRAME", name: "R", layout: "VERTICAL", children: [] }], { docLanguage: "fr" }), ".component.ts");
    strict_1.default.match(fr, /Généré par Bridge/);
    const en = fileNamed(emit([{ type: "FRAME", name: "R", layout: "VERTICAL", children: [] }]), ".component.ts");
    strict_1.default.match(en, /Generated by Bridge/);
});
(0, node_test_1.test)("the css-vars strategy emits declarations instead of utility classes", () => {
    const result = emit([
        {
            type: "FRAME",
            name: "Root",
            layout: "VERTICAL",
            fill: tk("KB1", "main/color/base/100"),
            children: [],
        },
    ], { strategy: "css-vars" });
    // No utility class for the fill; the styler produced a declaration instead.
    strict_1.default.doesNotMatch(fileNamed(result, ".component.ts"), /bg-base-100/);
});
//# sourceMappingURL=angular.test.js.map