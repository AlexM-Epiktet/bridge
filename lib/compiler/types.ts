// ---------------------------------------------------------------------------
// types.ts — shared TypeScript types for the compiler pipeline
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Scene graph (raw input)
// ---------------------------------------------------------------------------

export type NodeType =
  | "FRAME"
  | "TEXT"
  | "INSTANCE"
  | "CLONE"
  | "RECTANGLE"
  | "ELLIPSE"
  | "REPEAT"
  | "CONDITIONAL"
  | "COMPONENT"
  | "COMPONENT_SET";

/** One axis of a component set: a property name and the values it can take. */
export interface VariantProperty {
  name: string;
  values: string[];
  default?: string;
}

/**
 * A component property exposed on a master component (Figma's TEXT / BOOLEAN /
 * INSTANCE_SWAP properties — VARIANT axes are declared separately via
 * {@link VariantProperty}).
 *
 * `bindTo` wires the property to a descendant layer so overriding the property
 * on an instance actually changes something. Without it the property exists but
 * drives nothing, which is almost always an authoring mistake.
 */
export interface ComponentProperty {
  name: string;
  type: "TEXT" | "BOOLEAN" | "INSTANCE_SWAP";
  default?: string | boolean;
  description?: string;
  bindTo?: {
    /** Name of the descendant layer the property drives. */
    layer: string;
    /** Which aspect of that layer the property drives. Inferred from `type` when omitted. */
    field?: "characters" | "visible" | "mainComponent";
  };
}

export interface FontSpec {
  family: string;
  style: string;
}

export interface SceneMetadata {
  name: string;
  width: number;
  height: number;
}

/**
 * Scene graph node as authored by a human or produced by a recipe.
 *
 * The schema stage is intentionally permissive: only `type` is guaranteed;
 * every other field depends on the node kind. We keep the shape as an open
 * record so that schema.ts / resolve.ts / codegen.ts can discriminate on
 * `type` and treat unknown fields as either errors or pass-throughs.
 */
export interface SceneNode {
  type: NodeType;
  name?: string;
  id?: string;

  // FRAME / layout
  layout?: string;
  primaryAxisSizing?: string;
  counterAxisSizing?: string;
  primaryAxisAlign?: string;
  counterAxisAlign?: string;
  gap?: string | ResolvedToken;
  padding?: string | ResolvedToken;
  paddingTop?: string | ResolvedToken;
  paddingRight?: string | ResolvedToken;
  paddingBottom?: string | ResolvedToken;
  paddingLeft?: string | ResolvedToken;
  radius?: string | ResolvedToken;
  radiusTopLeft?: string | ResolvedToken;
  radiusTopRight?: string | ResolvedToken;
  radiusBottomLeft?: string | ResolvedToken;
  radiusBottomRight?: string | ResolvedToken;
  fill?: string | ResolvedToken;
  stroke?: string | ResolvedToken;
  strokeWeight?: number;
  strokeAlign?: string;
  effectStyle?: string | ResolvedToken;
  clip?: boolean;

  // Size
  width?: number;
  height?: number;
  fillH?: boolean;
  fillV?: boolean;
  absolute?: { x?: number; y?: number };

  // Visual
  visible?: boolean;
  opacity?: number;

  // TEXT
  characters?: string;
  textStyle?: string | ResolvedToken;
  autoResize?: string;
  maxLines?: number;

  // INSTANCE
  component?: string;
  variant?: Record<string, string>;
  properties?: Record<string, unknown>;
  swaps?: Record<string, string>;

  // CLONE
  sourceNodeId?: string;
  sourceRef?: string;

  // CLONE / INSTANCE — deep overrides on descendants.
  overrides?: NodeOverride[];

  // REPEAT
  count?: number;
  data?: Array<Record<string, string>>;
  template?: SceneNode[];

  // CONDITIONAL
  when?: string;
  else?: SceneNode[];

  // COMPONENT_SET — the variant axes the set is combined along.
  variantProperties?: VariantProperty[];
  // COMPONENT — the value this variant takes on each axis, e.g. {variant: "primary"}.
  variantValues?: Record<string, string>;
  // COMPONENT / COMPONENT_SET — exposed TEXT / BOOLEAN / INSTANCE_SWAP properties.
  componentProperties?: ComponentProperty[];
  /** COMPONENT / COMPONENT_SET — published description. */
  description?: string;

  // Children (FRAME, CONDITIONAL, REPEAT template items...)
  children?: SceneNode[];

  // Extra fields populated post-resolve:
  _resolvedComponent?: ResolvedComponent;
  _resolvedSwaps?: Record<string, ResolvedComponent>;

  // Any other passthrough fields.
  [extra: string]: unknown;
}

/**
 * A deep override applied to a descendant of a CLONE or an INSTANCE.
 *
 * `find` locates the descendant by layer name, optionally narrowed by node
 * type. When several descendants share a name — a table's identical
 * `am-table-cell-value` cells, a rail's six `am-rail-item` layers — `nth`
 * picks one positionally (0-based, document order); without it the FIRST
 * match wins, which is a silent mis-target on repeated names.
 *
 * This is the only way to reach content a component does not expose as a
 * component property. It writes an ordinary Figma override: the instance
 * keeps its link to the master. It is NOT a licence to rebuild a component
 * from parts.
 */
export interface NodeOverride {
  find?: { name?: string; type?: string; nth?: number };
  set?: {
    characters?: string;
    fill?: string | ResolvedToken;
    visible?: boolean;
    properties?: Record<string, unknown>;
  };
}

/** @deprecated Overrides are no longer CLONE-only — use {@link NodeOverride}. */
export type CloneOverride = NodeOverride;

export interface SceneGraph {
  version: string;
  metadata: SceneMetadata;
  fonts: FontSpec[];
  nodes: SceneNode[];
}

// ---------------------------------------------------------------------------
// Resolved graph
// ---------------------------------------------------------------------------

export type ResolvedNode = SceneNode;

export interface ResolvedSceneGraph {
  version: string;
  metadata: SceneMetadata;
  fonts: FontSpec[];
  nodes: ResolvedNode[];
}

// ---------------------------------------------------------------------------
// Resolved tokens & imports
// ---------------------------------------------------------------------------

export type ResolvedKind = "variable" | "textStyle" | "effectStyle" | "component" | "icon" | "logo";

export interface ResolvedToken {
  ref: string;
  key: string;
  name: string;
  kind: ResolvedKind;
  importMethod: string | null;
}

export interface ResolvedComponent extends ResolvedToken {
  type?: string;
  properties?: Record<string, unknown>;
}

/**
 * An entry in the imports bundle. Every resolved token/component is also a
 * valid import entry. `localName` is an optional override for the generated
 * variable name.
 */
export interface ImportEntry extends ResolvedToken {
  localName?: string;
  type?: string;
  properties?: Record<string, unknown>;
}

export interface ImportBundle {
  variables?: ImportEntry[];
  components?: ImportEntry[];
  textStyles?: ImportEntry[];
  fonts?: FontSpec[];
}
