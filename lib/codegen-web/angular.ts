// ---------------------------------------------------------------------------
// angular.ts — emit an Angular component from a resolved scene graph
// ---------------------------------------------------------------------------
//
// The scene graph is already semantic: auto-layout frames, DS tokens, resolved
// component references. That is precisely what pixel-based design-to-code tools
// spend their effort trying to recover, so the transform here is mechanical
// rather than heuristic — and where it *would* have to guess, it flags instead.
//
// What this emitter refuses to do:
//   - invent a value for a token the KB cannot bind (see utility-map.ts)
//   - invent an element for a component with no code binding (see
//     component-bindings.ts)
//   - claim heading semantics it cannot know (every text node is a <span>,
//     and the caller is told to review that)
//
// The Figma board is not an input here. It is the *verification* surface: the
// generated component is compared against a screenshot of the board, which is
// the code-side equivalent of Gate B.

import type { ResolvedNode, ResolvedSceneGraph } from "../compiler/types.js";
import type { TokenRefIndex } from "./token-refs.js";
import type { StyleFlag, StyleStrategy, TokenStyler, StyleRole } from "./utility-map.js";
import { createStyler } from "./utility-map.js";
import type { AngularBinding, BindingIndex } from "./component-bindings.js";
import { bindingFor } from "./component-bindings.js";

// ---------------------------------------------------------------------------
// PUBLIC TYPES
// ---------------------------------------------------------------------------

export interface AngularEmitOptions {
  /** Component name in any case; normalised to kebab-case for files. */
  name: string;
  strategy?: StyleStrategy;
  /** Element selector prefix. Defaults to `am`. */
  selectorPrefix?: string;
  /** Class name prefix. Defaults to `Am`. */
  classPrefix?: string;
  /** Base class every component extends, or null for none. */
  baseClass?: { name: string; importPath: string } | null;
  /** Language for generated doc comments. Application code follows the
   * consumer's conventions, which are not always English. */
  docLanguage?: "en" | "fr";
  /** Indentation unit. Defaults to a tab. */
  indent?: string;
  /** Emit a Storybook CSF3 story alongside the component. */
  emitStories?: boolean;
  /** Bindings from the KB; without them every INSTANCE falls back or flags. */
  bindings?: BindingIndex;
  /** Name of the source spec, recorded in the generated doc comment. */
  specName?: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface AngularEmitResult {
  files: GeneratedFile[];
  flags: StyleFlag[];
  /** Findings that are not token violations but need a human decision. */
  notes: string[];
}

// ---------------------------------------------------------------------------
// NAMING
// ---------------------------------------------------------------------------

export function toKebabCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function toPascalCase(input: string): string {
  return toKebabCase(input)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** A valid TS identifier for a variant axis or property name. */
function toCamelCase(input: string): string {
  const pascal = toPascalCase(input);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// ---------------------------------------------------------------------------
// LAYOUT → UTILITY CLASSES
// ---------------------------------------------------------------------------

const PRIMARY_ALIGN: Record<string, string> = {
  MIN: "justify-start",
  CENTER: "justify-center",
  MAX: "justify-end",
  SPACE_BETWEEN: "justify-between",
};

const COUNTER_ALIGN: Record<string, string> = {
  MIN: "items-start",
  CENTER: "items-center",
  MAX: "items-end",
};

interface StyleContext {
  styler: TokenStyler;
  flags: StyleFlag[];
  notes: string[];
}

/** Run the styler and collect any flag it raises. */
function style(
  ctx: StyleContext,
  role: StyleRole,
  token: unknown,
  nodePath: string
): { classes: string[]; declarations: Array<[string, string]> } {
  const out = ctx.styler.styleFor(role, token, nodePath);
  if (out.flag) ctx.flags.push(out.flag);
  return { classes: out.classes, declarations: out.declarations };
}

/**
 * Padding is emitted as the tightest set of utilities that describes it:
 * one class when all sides match, axis classes when they pair up, individual
 * sides otherwise. Anything the styler cannot map is already flagged.
 */
function paddingClasses(node: ResolvedNode, ctx: StyleContext, nodePath: string): string[] {
  const sides: Array<[StyleRole, unknown]> = [
    ["pt", node.paddingTop],
    ["pr", node.paddingRight],
    ["pb", node.paddingBottom],
    ["pl", node.paddingLeft],
  ];
  if (sides.every(([, v]) => !v)) return [];

  const resolved = sides.map(([role, token]) =>
    token ? (style(ctx, role, token, nodePath).classes[0] ?? null) : null
  );
  const [top, right, bottom, left] = resolved;

  // Utility classes carry their role as a prefix; comparing the suffix tells
  // us whether two sides resolved to the same spacing step.
  const step = (cls: string | null): string | null => (cls ? cls.replace(/^p[trbl]?-/, "") : null);
  const [st, sr, sb, sl] = [step(top), step(right), step(bottom), step(left)];

  if (st && st === sr && st === sb && st === sl) return [`p-${st}`];

  const classes: string[] = [];
  if (st && st === sb) {
    classes.push(`py-${st}`);
  } else {
    if (top) classes.push(top);
    if (bottom) classes.push(bottom);
  }
  if (sr && sr === sl) {
    classes.push(`px-${sr}`);
  } else {
    if (right) classes.push(right);
    if (left) classes.push(left);
  }
  return classes;
}

/**
 * Translate a container node's layout and decoration into utility classes.
 * `isRoot` suppresses sizing classes, because the root's box is the host
 * element's business.
 */
function containerClasses(
  node: ResolvedNode,
  ctx: StyleContext,
  nodePath: string,
  isRoot = false
): string[] {
  const classes: string[] = [];

  if (node.layout === "HORIZONTAL") classes.push("flex", "flex-row");
  else if (node.layout === "VERTICAL") classes.push("flex", "flex-col");

  if (node.layout && node.layout !== "NONE") {
    const primary = node.primaryAxisAlign ? PRIMARY_ALIGN[node.primaryAxisAlign] : null;
    if (primary) classes.push(primary);
    const counter = node.counterAxisAlign ? COUNTER_ALIGN[node.counterAxisAlign] : null;
    if (counter) classes.push(counter);
  }

  if (node.gap) classes.push(...style(ctx, "gap", node.gap, nodePath).classes);
  classes.push(...paddingClasses(node, ctx, nodePath));
  if (node.fill) classes.push(...style(ctx, "bg", node.fill, nodePath).classes);
  if (node.stroke) classes.push(...style(ctx, "border", node.stroke, nodePath).classes);
  if (node.radius) classes.push(...style(ctx, "rounded", node.radius, nodePath).classes);

  if (!isRoot) {
    if (node.fillH) classes.push("w-full");
    if (node.fillV) classes.push("h-full");
    classes.push(...fixedSizeClasses(node, ctx, nodePath));
  }

  if (node.clip) classes.push("overflow-hidden");
  if (node.opacity != null && node.opacity !== 1) {
    classes.push(`opacity-${Math.round(node.opacity * 100)}`);
  }

  return classes;
}

/**
 * Fixed pixel sizes become arbitrary-value utilities.
 *
 * These are not design-system violations — a fixed width is a layout decision
 * the design made, not a token it should have used — but they are worth
 * surfacing, since a hardcoded box is usually the thing a developer wants to
 * make responsive.
 */
function fixedSizeClasses(node: ResolvedNode, ctx: StyleContext, nodePath: string): string[] {
  const classes: string[] = [];
  if (node.width != null && !node.fillH) {
    classes.push(`w-[${node.width}px]`);
    ctx.notes.push(`${nodePath}: fixed width ${node.width}px emitted as an arbitrary value.`);
  }
  if (node.height != null && !node.fillV) {
    classes.push(`h-[${node.height}px]`);
    ctx.notes.push(`${nodePath}: fixed height ${node.height}px emitted as an arbitrary value.`);
  }
  return classes;
}

/**
 * Derive typography utilities from a text style's name.
 *
 * The daisyUI Figma library names text styles `tailwind/sans/3xl/normal`, so
 * the size and weight are stated in the name. Styles outside that namespace
 * cannot be mapped without real metrics, and the extractor's metrics are only
 * trustworthy post-7.4 — so those are flagged rather than approximated.
 */
function textStyleClasses(textStyle: unknown, ctx: StyleContext, nodePath: string): string[] {
  if (!textStyle) return [];

  const name =
    typeof textStyle === "string"
      ? textStyle.replace(/^\$/, "")
      : ((textStyle as { name?: string }).name ?? "");

  // Style names carry decorative prefixes in real libraries ("🌀 tailwind/sans/3xl/normal"),
  // so the namespace is located as a segment rather than anchored at the start.
  const match = /(?:^|[/\s])tailwind\/[^/]+\/([^/]+)(?:\/([^/]+))?/.exec(name);
  if (!match) {
    ctx.flags.push({
      nodePath,
      role: "text",
      token: name || "(unknown)",
      reason:
        `text style "${name}" is not in the tailwind/* namespace, so no size or ` +
        `weight utility can be read from its name. Typography must be applied by hand.`,
    });
    return [];
  }

  const classes = [`text-${match[1]}`];
  // Figma names weights in camelCase ("semiBold"); the utility class is
  // lower-case ("font-semibold"), so the case must be folded rather than
  // passed through.
  const weight = match[2]?.toLowerCase();
  if (weight && weight !== "normal") classes.push(`font-${weight}`);
  return classes;
}

// ---------------------------------------------------------------------------
// DAISYUI PRIMITIVES
// ---------------------------------------------------------------------------

/**
 * Components implemented as framework classes on a native element rather than
 * as Angular components. The variant axes map onto the framework's own
 * modifier convention (`btn` + `btn-primary` + `btn-sm`), which is why the
 * mapping is a lookup and not a guess.
 */
const DAISY_PRIMITIVES: Record<string, { tag: string; base: string; axes: string[] }> = {
  button: { tag: "button", base: "btn", axes: ["variant", "color", "size", "style"] },
  badge: { tag: "span", base: "badge", axes: ["variant", "color", "size", "style"] },
  alert: { tag: "div", base: "alert", axes: ["color", "variant"] },
  card: { tag: "div", base: "card", axes: ["variant"] },
};

function primitiveFor(componentName: string): { tag: string; base: string; axes: string[] } | null {
  const key =
    componentName
      .replace(/^\$comp\//, "")
      .split("/")
      .pop()
      ?.toLowerCase() ?? "";
  return DAISY_PRIMITIVES[key] ?? null;
}

/**
 * Strip the decorative prefixes real Figma libraries put on variant axes
 * (`📐 size`, `🎨 color`) so axis lookup matches on the meaningful word.
 * Without this every axis on a published library component misses.
 */
function normaliseAxisNames(variant: Record<string, string> | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const [axis, value] of Object.entries(variant ?? {})) {
    const clean = axis
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .toLowerCase();
    if (clean) out.set(clean, value);
  }
  return out;
}

// ---------------------------------------------------------------------------
// TEMPLATE EMISSION
// ---------------------------------------------------------------------------

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function classAttr(classes: readonly string[]): string {
  const unique = Array.from(new Set(classes.filter(Boolean)));
  return unique.length > 0 ? ` class="${unique.join(" ")}"` : "";
}

interface TemplateContext extends StyleContext {
  bindings: BindingIndex;
  /** Selector → import path, accumulated for the component's `imports` array. */
  usedComponents: Map<string, string>;
}

function emitNode(
  node: ResolvedNode,
  ctx: TemplateContext,
  indent: string,
  depth: number,
  parentPath: string
): string[] {
  const pad = indent.repeat(depth);
  const nodePath = parentPath
    ? `${parentPath} > ${node.name ?? node.type}`
    : (node.name ?? node.type);
  const lines: string[] = [];

  const hidden = node.visible === false ? " hidden" : "";

  switch (node.type) {
    case "FRAME":
    case "COMPONENT": {
      const classes = containerClasses(node, ctx, nodePath);
      const children = Array.isArray(node.children) ? node.children : [];
      if (children.length === 0) {
        lines.push(`${pad}<div${classAttr([...classes, hidden.trim()])}></div>`);
      } else {
        lines.push(`${pad}<div${classAttr([...classes, hidden.trim()])}>`);
        for (const child of children) {
          lines.push(...emitNode(child, ctx, indent, depth + 1, nodePath));
        }
        lines.push(`${pad}</div>`);
      }
      break;
    }

    case "TEXT": {
      const classes = [
        ...textStyleClasses(node.textStyle, ctx, nodePath),
        ...(node.fill ? style(ctx, "text", node.fill, nodePath).classes : []),
        ...(node.fillH ? ["w-full"] : []),
        hidden.trim(),
      ];
      lines.push(`${pad}<span${classAttr(classes)}>${escapeText(node.characters ?? "")}</span>`);
      break;
    }

    case "INSTANCE": {
      lines.push(...emitInstance(node, ctx, pad, nodePath));
      break;
    }

    case "RECTANGLE":
    case "ELLIPSE": {
      const classes = [
        ...(node.fill ? style(ctx, "bg", node.fill, nodePath).classes : []),
        ...(node.stroke ? style(ctx, "border", node.stroke, nodePath).classes : []),
        ...(node.radius ? style(ctx, "rounded", node.radius, nodePath).classes : []),
        ...fixedSizeClasses(node, ctx, nodePath),
        ...(node.type === "ELLIPSE" ? ["rounded-full"] : []),
        hidden.trim(),
      ];
      lines.push(`${pad}<div${classAttr(classes)} aria-hidden="true"></div>`);
      break;
    }

    default: {
      ctx.notes.push(
        `${nodePath}: node type ${node.type} has no Angular representation and was skipped.`
      );
      break;
    }
  }

  return lines;
}

/**
 * An INSTANCE resolves in three steps: a real Angular component from the KB
 * binding, a framework primitive, or a flag. It never becomes an invented
 * element.
 */
function emitInstance(
  node: ResolvedNode,
  ctx: TemplateContext,
  pad: string,
  nodePath: string
): string[] {
  const componentRef = node._resolvedComponent ?? node.component;
  const binding: AngularBinding | null = bindingFor(ctx.bindings, componentRef);

  if (binding && binding.selector) {
    if (binding.lib) ctx.usedComponents.set(binding.selector, binding.lib);
    const attrs = variantAttributes(node);
    return [`${pad}<${binding.selector}${attrs} />`];
  }

  const rawName =
    typeof componentRef === "string"
      ? componentRef
      : ((componentRef as { name?: string } | undefined)?.name ?? node.component ?? "");

  const primitive = primitiveFor(rawName);
  if (primitive) {
    const axisValues = normaliseAxisNames(node.variant);
    const modifiers = primitive.axes
      .map((axis) => axisValues.get(axis))
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      // `default` is the framework's unmodified state; naming it would produce
      // a class the framework does not define.
      .filter((v) => v !== "default")
      .map((v) => `${primitive.base}-${toKebabCase(v)}`);
    const label = instanceLabel(node);
    const classes = [primitive.base, ...modifiers];
    return [`${pad}<${primitive.tag}${classAttr(classes)}>${escapeText(label)}</${primitive.tag}>`];
  }

  ctx.flags.push({
    nodePath,
    role: "text",
    token: rawName || "(unknown component)",
    reason:
      `no Angular binding and no known framework primitive for "${rawName}". ` +
      `Add an \`angular\` block to its components.json entry, or implement the component.`,
  });
  return [`${pad}<!-- bridge: unmapped component "${escapeText(rawName)}" -->`];
}

/**
 * Text a primitive should render, taken from an explicit property.
 *
 * Real component properties are named `↪ ✏️ label#6519:0` — a decorative
 * prefix and a node-id suffix around the meaningful word — so the lookup
 * normalises before matching. Falling back to the layer name would put a
 * designer's layer label into the UI, which is why it is the last resort.
 */
function instanceLabel(node: ResolvedNode): string {
  const wanted = new Set(["label", "text", "children", "title"]);
  for (const [key, value] of Object.entries(node.properties ?? {})) {
    if (typeof value !== "string") continue;
    if (wanted.has(normalisePropertyName(key))) return value;
  }
  return node.name ?? "";
}

/** Strip a property's decorative prefix and `#nodeId` suffix. */
function normalisePropertyName(key: string): string {
  return key
    .replace(/#.*$/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

/**
 * Carry declared instance properties through as attribute bindings, using the
 * normalised property name so `↪ ✏️ label#6519:0` becomes `label` rather than
 * an unusable identifier.
 */
function variantAttributes(node: ResolvedNode): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(node.properties ?? {})) {
    const name = toCamelCase(normalisePropertyName(key));
    if (!name) continue;
    if (typeof value === "string") {
      parts.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
    } else if (typeof value === "boolean" || typeof value === "number") {
      parts.push(`[${name}]="${String(value)}"`);
    }
  }
  for (const [axis, value] of Object.entries(node.variant ?? {})) {
    const name = toCamelCase(normalisePropertyName(axis));
    if (name) parts.push(`${name}="${value}"`);
  }
  return parts.length > 0 ? " " + parts.join(" ") : "";
}

// ---------------------------------------------------------------------------
// COMPONENT API (inputs)
// ---------------------------------------------------------------------------

interface InputDecl {
  name: string;
  tsType: string;
  signalType: string;
  initializer: string;
  doc: string;
}

/**
 * The Figma component's declared properties *are* its public API, so they map
 * one-to-one onto Angular inputs. Nothing else does: text inside a plain frame
 * is content, not a parameter, and turning it into an input would be a guess
 * about intent.
 */
function inputsFor(root: ResolvedNode | undefined, docLanguage: "en" | "fr"): InputDecl[] {
  if (!root) return [];
  const inputs: InputDecl[] = [];

  for (const axis of root.variantProperties ?? []) {
    const union = axis.values.map((v) => `'${v}'`).join(" | ");
    const fallback = axis.default ?? axis.values[0] ?? "";
    inputs.push({
      name: toCamelCase(axis.name),
      tsType: union,
      signalType: `InputSignal<${union}>`,
      initializer: `input<${union}>('${fallback}')`,
      doc: docLanguage === "fr" ? `Variante « ${axis.name} ».` : `The "${axis.name}" variant axis.`,
    });
  }

  for (const prop of root.componentProperties ?? []) {
    const tsType = prop.type === "BOOLEAN" ? "boolean" : "string";
    const fallback =
      prop.default !== undefined
        ? typeof prop.default === "boolean"
          ? String(prop.default)
          : `'${String(prop.default).replace(/'/g, "\\'")}'`
        : prop.type === "BOOLEAN"
          ? "false"
          : "''";
    inputs.push({
      name: toCamelCase(prop.name),
      tsType,
      signalType: `InputSignal<${tsType}>`,
      initializer: `input<${tsType}>(${fallback})`,
      doc:
        prop.description ??
        (docLanguage === "fr" ? `Propriété « ${prop.name} ».` : `The "${prop.name}" property.`),
    });
  }

  return inputs;
}

// ---------------------------------------------------------------------------
// FILE EMISSION
// ---------------------------------------------------------------------------

/**
 * Emit an Angular component from a resolved scene graph.
 */
export function emitAngularComponent(
  graph: ResolvedSceneGraph,
  refs: TokenRefIndex,
  opts: AngularEmitOptions
): AngularEmitResult {
  const indent = opts.indent ?? "\t";
  const selectorPrefix = opts.selectorPrefix ?? "am";
  const classPrefix = opts.classPrefix ?? "Am";
  const docLanguage = opts.docLanguage ?? "en";
  const bindings = opts.bindings ?? { byName: new Map(), byKey: new Map(), unusable: [] };

  const kebab = toKebabCase(opts.name);
  const selector = `${selectorPrefix}-${kebab}`;
  const className = `${classPrefix}${toPascalCase(opts.name)}`;

  const ctx: TemplateContext = {
    styler: createStyler(opts.strategy ?? "tailwind-daisyui", refs),
    flags: [],
    notes: [],
    bindings,
    usedComponents: new Map(),
  };

  // The scene's single top-level node becomes the host element; its children
  // become the template. A multi-root scene keeps a wrapper div, since a
  // component has exactly one host.
  const roots = graph.nodes ?? [];
  const singleRoot = roots.length === 1 ? roots[0] : undefined;
  const hostClasses = singleRoot
    ? containerClasses(singleRoot, ctx, singleRoot.name ?? "root", true)
    : [];

  const bodyNodes = singleRoot
    ? Array.isArray(singleRoot.children)
      ? singleRoot.children
      : []
    : roots;
  const rootPath = singleRoot?.name ?? "";

  const templateLines: string[] = [];
  for (const node of bodyNodes) {
    templateLines.push(...emitNode(node, ctx, indent, 0, rootPath));
  }

  if (roots.length > 1) {
    ctx.notes.push(
      `The scene has ${roots.length} top-level nodes; they were emitted side by side. ` +
        `A component has a single host element, so consider wrapping them in one frame.`
    );
  }

  const inputs = inputsFor(singleRoot, docLanguage);
  if (singleRoot?.type === "COMPONENT_SET") {
    const variantCount = Array.isArray(singleRoot.children) ? singleRoot.children.length : 0;
    ctx.notes.push(
      `The source is a component set with ${variantCount} variants. The template renders the ` +
        `default variant and the axes are exposed as inputs, but the per-variant class ` +
        `differences are not wired — review each axis and bind it to the classes it changes.`
    );
  }

  if (templateLines.some((l) => l.includes("<span"))) {
    ctx.notes.push(
      "Text nodes are emitted as <span>. Promote the ones that are headings to <h1>–<h6> — " +
        "heading level is a semantic decision the scene graph does not record."
    );
  }

  const files: GeneratedFile[] = [];
  const dir = kebab;
  const template = templateLines.join("\n") + "\n";

  files.push({ path: `${dir}/${kebab}.component.html`, content: template });
  files.push({
    path: `${dir}/${kebab}.component.ts`,
    content: renderClassFile({
      className,
      selector,
      kebab,
      hostClasses,
      inputs,
      indent,
      docLanguage,
      specName: opts.specName ?? opts.name,
      baseClass: opts.baseClass ?? null,
      usedComponents: ctx.usedComponents,
    }),
  });

  if (opts.emitStories !== false) {
    files.push({
      path: `${dir}/${kebab}.component.stories.ts`,
      content: renderStoryFile({ className, kebab, inputs, indent, docLanguage }),
    });
  }

  return { files, flags: ctx.flags, notes: ctx.notes };
}

interface ClassFileParams {
  className: string;
  selector: string;
  kebab: string;
  hostClasses: string[];
  inputs: InputDecl[];
  indent: string;
  docLanguage: "en" | "fr";
  specName: string;
  baseClass: { name: string; importPath: string } | null;
  usedComponents: Map<string, string>;
}

function renderClassFile(p: ClassFileParams): string {
  const i = p.indent;
  const angularImports = ["ChangeDetectionStrategy", "Component"];
  if (p.inputs.length > 0) angularImports.push("input", "InputSignal");

  const lines: string[] = [];
  lines.push(`import { ${angularImports.sort().join(", ")} } from '@angular/core';`);

  if (p.baseClass) {
    lines.push(`import { ${p.baseClass.name} } from '${p.baseClass.importPath}';`);
  }

  // One import statement per library, listing the selectors used from it.
  const byLib = new Map<string, string[]>();
  for (const [selector, lib] of p.usedComponents) {
    const list = byLib.get(lib) ?? [];
    list.push(toPascalCase(selector));
    byLib.set(lib, list);
  }
  for (const [lib, names] of Array.from(byLib).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`import { ${names.sort().join(", ")} } from '${lib}';`);
  }

  lines.push("");
  lines.push("/**");
  lines.push(
    p.docLanguage === "fr"
      ? ` * Généré par Bridge depuis la spec \`${p.specName}\`.`
      : ` * Generated by Bridge from the \`${p.specName}\` spec.`
  );
  lines.push(
    p.docLanguage === "fr"
      ? " * Régénérer plutôt que modifier à la main tant que la spec fait foi."
      : " * Regenerate rather than hand-edit for as long as the spec is the source of truth."
  );
  lines.push(" */");

  lines.push("@Component({");
  lines.push(`${i}selector: '${p.selector}',`);
  lines.push(`${i}templateUrl: './${p.kebab}.component.html',`);
  if (p.hostClasses.length > 0) {
    lines.push(`${i}host: { class: '${Array.from(new Set(p.hostClasses)).join(" ")}' },`);
  }
  const importNames = Array.from(byLib.values()).flat().sort();
  if (importNames.length > 0) {
    lines.push(`${i}imports: [${importNames.join(", ")}],`);
  }
  lines.push(`${i}changeDetection: ChangeDetectionStrategy.OnPush,`);
  lines.push("})");

  const extendsClause = p.baseClass ? ` extends ${p.baseClass.name}` : "";
  if (p.inputs.length === 0) {
    lines.push(`export class ${p.className}${extendsClause} {}`);
  } else {
    lines.push(`export class ${p.className}${extendsClause} {`);
    p.inputs.forEach((input, index) => {
      if (index > 0) lines.push("");
      lines.push(`${i}/** ${input.doc} */`);
      lines.push(`${i}public readonly ${input.name}: ${input.signalType} = ${input.initializer};`);
    });
    lines.push("}");
  }

  return lines.join("\n") + "\n";
}

interface StoryFileParams {
  className: string;
  kebab: string;
  inputs: InputDecl[];
  indent: string;
  docLanguage: "en" | "fr";
}

function renderStoryFile(p: StoryFileParams): string {
  const i = p.indent;
  const args = p.inputs
    .map((input) => `${i}${i}${input.name}: ${defaultArgLiteral(input)},`)
    .join("\n");

  const lines = [
    `import { moduleMetadata, applicationConfig } from '@storybook/angular';`,
    `import type { Meta, StoryObj } from '@storybook/angular';`,
    `import { provideZonelessChangeDetection } from '@angular/core';`,
    `import { ${p.className} } from './${p.kebab}.component';`,
    "",
    `const meta: Meta<${p.className}> = {`,
    `${i}title: 'Generated/${toPascalCase(p.kebab)}',`,
    `${i}component: ${p.className},`,
    `${i}decorators: [`,
    `${i}${i}moduleMetadata({ imports: [${p.className}] }),`,
    `${i}${i}applicationConfig({ providers: [provideZonelessChangeDetection()] }),`,
    `${i}],`,
    `};`,
    `export default meta;`,
    `type Story = StoryObj<${p.className}>;`,
    "",
    `export const ${p.docLanguage === "fr" ? "Defaut" : "Default"}: Story = {`,
    args ? `${i}args: {\n${args}\n${i}},` : `${i}args: {},`,
    `};`,
  ];

  return lines.join("\n") + "\n";
}

function defaultArgLiteral(input: InputDecl): string {
  if (input.tsType === "boolean") return input.initializer.includes("true") ? "true" : "false";
  const match = /input<[^>]*>\('([^']*)'\)/.exec(input.initializer);
  return match ? `'${match[1]}'` : "''";
}
