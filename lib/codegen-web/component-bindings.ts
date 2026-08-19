// ---------------------------------------------------------------------------
// component-bindings.ts — read the Figma ↔ code mapping out of the KB
// ---------------------------------------------------------------------------
//
// `components.json` entries may carry an `angular` block linking a Figma
// component to the real component that implements it:
//
//   { "name": "am-table", "key": "…", "angular": {
//       "selector": "am-table", "lib": "@amelis/foundation/web-ui",
//       "path": "libs/…/table.component.ts", "kind": "component" } }
//
// That mapping is maintained alongside the design system and is the only
// trustworthy way to turn `$comp/X` into a real element. Bridge reads it; it
// never invents one.
//
// Two `kind` values deliberately do NOT yield an element:
//   - `missing`  — the Figma component has no implementation yet.
//   - `daisyui`  — it is a framework primitive, styled with classes rather
//                  than wrapped in a component.
// Both fall through to the primitive path or to a flag, which is the point:
// the generator says "there is nothing to call here" instead of emitting an
// import that will not resolve.

import * as fs from "node:fs";
import * as path from "node:path";

export interface AngularBinding {
  /** Angular element selector, e.g. `am-input-field`. Null when none exists. */
  selector: string | null;
  /** Import path alias, e.g. `@amelis/foundation/web-ui`. */
  lib: string | null;
  /** Source file, relative to the consumer workspace root. */
  sourcePath: string | null;
  kind: string;
  note?: string;
}

export interface BindingIndex {
  /** Lower-cased Figma component name → binding. */
  byName: Map<string, AngularBinding>;
  byKey: Map<string, AngularBinding>;
  /** Bindings that exist but cannot produce an element, with the reason. */
  unusable: Array<{ name: string; kind: string; reason: string }>;
}

interface RawComponent {
  name?: string;
  key?: string;
  angular?: {
    selector?: string | null;
    lib?: string | null;
    path?: string | null;
    kind?: string;
    note?: string;
  };
}

/** Kinds that describe something callable from a template. */
const ELEMENT_KINDS = new Set([
  "component",
  "variant",
  "composite",
  "page",
  "partial",
  "dialog",
  "template",
  "part",
  "app-root",
]);

/**
 * Load the Figma → Angular bindings from `<kbPath>/knowledge-base/registries/components.json`.
 *
 * A missing or malformed file yields an empty index rather than an error:
 * bindings are an enrichment, and a KB without them should still generate
 * markup (falling back to primitives and flags).
 */
export function loadComponentBindings(kbPath: string): BindingIndex {
  const file = path.join(kbPath, "knowledge-base", "registries", "components.json");
  const byName = new Map<string, AngularBinding>();
  const byKey = new Map<string, AngularBinding>();
  const unusable: BindingIndex["unusable"] = [];

  let components: RawComponent[] = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { components?: unknown };
    if (Array.isArray(parsed.components)) components = parsed.components as RawComponent[];
  } catch {
    return { byName, byKey, unusable };
  }

  for (const c of components) {
    if (!c.angular || !c.name) continue;
    const kind = c.angular.kind ?? "component";

    const binding: AngularBinding = {
      selector: c.angular.selector ?? null,
      lib: c.angular.lib ?? null,
      sourcePath: c.angular.path ?? null,
      kind,
      ...(c.angular.note ? { note: c.angular.note } : {}),
    };

    if (!binding.selector || !ELEMENT_KINDS.has(kind)) {
      unusable.push({
        name: c.name,
        kind,
        reason: !binding.selector
          ? `binding declares no selector (kind: ${kind})`
          : `kind "${kind}" does not describe a callable element`,
      });
      continue;
    }

    byName.set(c.name.toLowerCase(), binding);
    if (c.key) byKey.set(c.key, binding);
  }

  return { byName, byKey, unusable };
}

/** Look up a binding by resolved component token or by raw name. */
export function bindingFor(index: BindingIndex, component: unknown): AngularBinding | null {
  if (!component) return null;

  if (typeof component === "string") {
    const name = component.replace(/^\$comp\//, "").replace(/^\$/, "");
    return index.byName.get(name.toLowerCase()) ?? null;
  }

  if (typeof component === "object") {
    const c = component as { key?: unknown; name?: unknown };
    if (typeof c.key === "string") {
      const hit = index.byKey.get(c.key);
      if (hit) return hit;
    }
    if (typeof c.name === "string") {
      return index.byName.get(c.name.toLowerCase()) ?? null;
    }
  }

  return null;
}
