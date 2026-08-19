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
  /** Structural path → variant wiring, when the source is a component set. */
  classPlan?: Map<string, ClassPlan>;
}

/**
 * Render a node's class attributes.
 *
 * When a node's classes differ between variants, the shared ones stay a static
 * `class` and the rest move to a `[class]` binding. Angular merges the two, so
 * the static half remains greppable in the template instead of disappearing
 * into a lookup table.
 */
function classAttrFor(
  ctx: TemplateContext,
  structPath: string,
  classes: readonly string[]
): string {
  const plan = ctx.classPlan?.get(structPath);
  if (!plan) return classAttr(classes);

  const dynamic = new Set(plan.variantClasses);
  const staticPart = classes.filter((c) => c && !dynamic.has(c));
  return `${classAttr(staticPart)} [class]="${plan.signal}()"`;
}

function emitNode(
  node: ResolvedNode,
  ctx: TemplateContext,
  indent: string,
  depth: number,
  parentPath: string,
  structPath = ""
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
      const attrs = classAttrFor(ctx, structPath, [...classes, hidden.trim()]);
      const children = Array.isArray(node.children) ? node.children : [];
      if (children.length === 0) {
        lines.push(`${pad}<div${attrs}></div>`);
      } else {
        lines.push(`${pad}<div${attrs}>`);
        children.forEach((child, i) => {
          lines.push(
            ...emitNode(child, ctx, indent, depth + 1, nodePath, childPath(structPath, i))
          );
        });
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
      lines.push(
        `${pad}<span${classAttrFor(ctx, structPath, classes)}>${escapeText(node.characters ?? "")}</span>`
      );
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
      lines.push(`${pad}<div${classAttrFor(ctx, structPath, classes)} aria-hidden="true"></div>`);
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

function childPath(parent: string, index: number): string {
  return parent ? `${parent}.${index}` : String(index);
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
// VARIANT WIRING
// ---------------------------------------------------------------------------

export interface ClassPlan {
  /** Every class this node takes in at least one variant but not all of them. */
  variantClasses: string[];
  /** Name of the computed signal that supplies them at runtime. */
  signal: string;
}

interface VariantTable {
  constName: string;
  signal: string;
  /** Variant key (axis values joined by `|`) → class string. */
  entries: Array<[string, string]>;
}

interface VariantWiring {
  plan: Map<string, ClassPlan>;
  tables: VariantTable[];
  /** camelCase input names, in axis-declaration order. */
  axisInputs: string[];
  notes: string[];
}

/**
 * Compute a node's classes without emitting markup, so variants can be compared
 * before the template is written.
 *
 * INSTANCE nodes are skipped: they render an element rather than a styled box,
 * so a class diff does not describe how they change between variants.
 */
function collectClasses(
  node: ResolvedNode,
  ctx: StyleContext,
  structPath: string,
  out: Map<string, string[]>
): void {
  const nodePath = node.name ?? node.type;

  switch (node.type) {
    case "FRAME":
    case "COMPONENT": {
      out.set(structPath, containerClasses(node, ctx, nodePath));
      const children = Array.isArray(node.children) ? node.children : [];
      children.forEach((child, i) => collectClasses(child, ctx, childPath(structPath, i), out));
      break;
    }
    case "TEXT":
      out.set(structPath, [
        ...textStyleClasses(node.textStyle, ctx, nodePath),
        ...(node.fill ? style(ctx, "text", node.fill, nodePath).classes : []),
      ]);
      break;
    case "RECTANGLE":
    case "ELLIPSE":
      out.set(structPath, [
        ...(node.fill ? style(ctx, "bg", node.fill, nodePath).classes : []),
        ...(node.stroke ? style(ctx, "border", node.stroke, nodePath).classes : []),
        ...(node.radius ? style(ctx, "rounded", node.radius, nodePath).classes : []),
      ]);
      break;
    default:
      break;
  }
}

/** The key a variant is looked up by: its axis values in declaration order. */
function variantKey(variantValues: Record<string, string> | undefined, axes: string[]): string {
  return axes.map((a) => variantValues?.[a] ?? "").join("|");
}

/**
 * The variant whose tree seeds the template: the one matching every axis
 * default, falling back to the first. Rendering an arbitrary variant would make
 * the generated component's resting state depend on authoring order.
 */
function defaultVariantOf(setNode: ResolvedNode): ResolvedNode | undefined {
  const variants = (Array.isArray(setNode.children) ? setNode.children : []).filter(
    (c) => c.type === "COMPONENT"
  );
  if (variants.length === 0) return undefined;

  const axes = setNode.variantProperties ?? [];
  const defaults = axes.filter((a) => a.default !== undefined);
  if (defaults.length > 0) {
    const match = variants.find((v) =>
      defaults.every((a) => v.variantValues?.[a.name] === a.default)
    );
    if (match) return match;
  }
  return variants[0];
}

/**
 * Work out which classes actually change between the variants of a component
 * set, and how to select them at runtime.
 *
 * The set's variants usually differ in a handful of decorative properties while
 * sharing their whole structure, so the useful output is small: for each node
 * that changes, the classes it takes per variant combination. Everything
 * identical across variants stays a plain static class.
 *
 * Variants whose structure differs from the reference are not wired — a class
 * diff is only meaningful between trees of the same shape — and that is
 * reported rather than approximated.
 */
function planVariantClasses(
  setNode: ResolvedNode,
  styler: TokenStyler,
  docLanguage: "en" | "fr"
): VariantWiring {
  const notes: string[] = [];
  const axes = (setNode.variantProperties ?? []).map((a) => a.name);
  const variants = (Array.isArray(setNode.children) ? setNode.children : []).filter(
    (c) => c.type === "COMPONENT"
  );

  const empty: VariantWiring = { plan: new Map(), tables: [], axisInputs: [], notes };
  if (axes.length === 0 || variants.length < 2) return empty;

  // Flags raised here would duplicate those from the emit pass, which walks the
  // reference variant with the real context. Collection uses a scratch context.
  const scratch: StyleContext = { styler, flags: [], notes: [] };

  const byVariant = new Map<string, Map<string, string[]>>();
  const reference = variants[0]!;
  const referenceMap = new Map<string, string[]>();
  collectClasses(reference, scratch, "", referenceMap);

  for (const variant of variants) {
    const map = new Map<string, string[]>();
    collectClasses(variant, scratch, "", map);
    if (map.size !== referenceMap.size) {
      notes.push(
        `Variant "${variant.name ?? "?"}" has a different structure from the first variant, ` +
          `so its class differences were not wired. Give every variant the same layer tree, ` +
          `or wire this axis by hand.`
      );
      continue;
    }
    byVariant.set(variantKey(variant.variantValues, axes), map);
  }

  if (byVariant.size < 2) return { ...empty, notes };

  const plan = new Map<string, ClassPlan>();
  const tables: VariantTable[] = [];

  for (const structPath of referenceMap.keys()) {
    const perVariant = new Map<string, string[]>();
    for (const [key, map] of byVariant) perVariant.set(key, map.get(structPath) ?? []);

    // A class present in every variant is static; the rest are what changes.
    const counts = new Map<string, number>();
    for (const classes of perVariant.values()) {
      for (const c of new Set(classes)) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const changing = [...counts.entries()]
      .filter(([, n]) => n < perVariant.size)
      .map(([c]) => c)
      .sort();

    if (changing.length === 0) continue;

    // Names are positional rather than path-derived: a structural path makes a
    // poor identifier (`variantClasses_0_1`) and the mapping does not need to be
    // readable from the name — the table above each signal already says what it
    // selects.
    const isRoot = structPath === "";
    // The root is named rather than numbered, so the counter skips it and the
    // first numbered table is 1.
    const ordinal = tables.filter((t) => t.signal !== "rootVariantClasses").length + 1;
    const signal = isRoot ? "rootVariantClasses" : `variantClasses${ordinal}`;
    const constName = isRoot ? "ROOT_VARIANT_CLASSES" : `VARIANT_CLASSES_${ordinal}`;
    plan.set(structPath, { variantClasses: changing, signal });

    const changingSet = new Set(changing);
    tables.push({
      constName,
      signal,
      entries: [...byVariant.keys()].map((key) => [
        key,
        (perVariant.get(key) ?? []).filter((c) => changingSet.has(c)).join(" "),
      ]),
    });
  }

  if (plan.size > 0) {
    notes.push(
      docLanguage === "fr"
        ? `${plan.size} nœud(s) changent de classes selon la variante ; les tables générées sont vérifiables à la lecture.`
        : `${plan.size} node(s) change classes across variants; the generated lookup tables are reviewable at a glance.`
    );
  }

  return {
    plan,
    tables,
    axisInputs: axes.map((a) => toCamelCase(normalisePropertyName(a))),
    notes,
  };
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

  // A component set is not itself renderable: one Angular component covers the
  // whole matrix, so the template is built from one variant and the axes become
  // inputs. Emitting every variant side by side would render the Figma canvas
  // rather than the component.
  const isSet = singleRoot?.type === "COMPONENT_SET";
  const wiring = isSet
    ? planVariantClasses(singleRoot!, ctx.styler, docLanguage)
    : { plan: new Map<string, ClassPlan>(), tables: [], axisInputs: [], notes: [] };
  ctx.classPlan = wiring.plan;
  ctx.notes.push(...wiring.notes);

  const templateRoot = isSet ? defaultVariantOf(singleRoot!) : singleRoot;

  const hostClasses = templateRoot
    ? containerClasses(templateRoot, ctx, templateRoot.name ?? "root", true)
    : [];

  const bodyNodes = templateRoot
    ? Array.isArray(templateRoot.children)
      ? templateRoot.children
      : []
    : roots;
  const rootPath = templateRoot?.name ?? "";

  const templateLines: string[] = [];
  bodyNodes.forEach((node, i) => {
    templateLines.push(...emitNode(node, ctx, indent, 0, rootPath, childPath("", i)));
  });

  if (roots.length > 1) {
    ctx.notes.push(
      `The scene has ${roots.length} top-level nodes; they were emitted side by side. ` +
        `A component has a single host element, so consider wrapping them in one frame.`
    );
  }

  const inputs = inputsFor(singleRoot, docLanguage);
  if (isSet) {
    const variantCount = Array.isArray(singleRoot!.children) ? singleRoot!.children.length : 0;
    ctx.notes.push(
      `The source is a component set with ${variantCount} variants; the template renders the ` +
        `default one and every axis is exposed as an input.` +
        (wiring.plan.size === 0
          ? ` No class differences were found between variants, so nothing needed wiring.`
          : ``)
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
      wiring,
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
  wiring: VariantWiring;
}

function renderClassFile(p: ClassFileParams): string {
  const i = p.indent;
  const hasWiring = p.wiring.tables.length > 0;

  const angularImports = ["ChangeDetectionStrategy", "Component"];
  if (p.inputs.length > 0) angularImports.push("input", "InputSignal");
  if (hasWiring) angularImports.push("computed", "Signal");

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

  // Variant lookup tables live at module scope: they are constants derived from
  // the design, not per-instance state, and keeping them out of the class makes
  // the whole matrix readable in one place during review. They precede the
  // component's doc comment so that comment stays attached to @Component.
  const rootPlan = p.wiring.plan.get("");
  if (hasWiring) {
    lines.push("");
    for (const table of p.wiring.tables) {
      lines.push(`/** Keyed by \`${p.wiring.axisInputs.join(" | ")}\`. */`);
      lines.push(`const ${table.constName}: Record<string, string> = {`);
      for (const [key, classes] of table.entries) {
        lines.push(`${i}'${key}': '${classes}',`);
      }
      lines.push("};");
    }
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

  const staticHost = Array.from(new Set(p.hostClasses)).filter(
    (c) => !rootPlan?.variantClasses.includes(c)
  );
  if (rootPlan) {
    // The host's own classes are split the same way a child's are: the shared
    // ones stay declarative, the variant-dependent ones come from the signal.
    lines.push(
      `${i}host: { class: '${staticHost.join(" ")}', '[class]': '${rootPlan.signal}()' },`
    );
  } else if (staticHost.length > 0) {
    lines.push(`${i}host: { class: '${staticHost.join(" ")}' },`);
  }

  const importNames = Array.from(byLib.values()).flat().sort();
  if (importNames.length > 0) {
    lines.push(`${i}imports: [${importNames.join(", ")}],`);
  }
  lines.push(`${i}changeDetection: ChangeDetectionStrategy.OnPush,`);
  lines.push("})");

  const extendsClause = p.baseClass ? ` extends ${p.baseClass.name}` : "";
  const members: string[][] = [];

  for (const input of p.inputs) {
    members.push([
      `${i}/** ${input.doc} */`,
      `${i}public readonly ${input.name}: ${input.signalType} = ${input.initializer};`,
    ]);
  }

  // `protected` because the template is the only consumer — the house rule is
  // that anything not part of the public API stays out of it.
  const key = p.wiring.axisInputs.map((a) => `\${this.${a}()}`).join("|");
  for (const table of p.wiring.tables) {
    members.push([
      `${i}protected readonly ${table.signal}: Signal<string> = computed(`,
      `${i}${i}() => ${table.constName}[\`${key}\`] ?? ''`,
      `${i});`,
    ]);
  }

  if (members.length === 0) {
    lines.push(`export class ${p.className}${extendsClause} {}`);
  } else {
    lines.push(`export class ${p.className}${extendsClause} {`);
    members.forEach((member, index) => {
      if (index > 0) lines.push("");
      lines.push(...member);
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
