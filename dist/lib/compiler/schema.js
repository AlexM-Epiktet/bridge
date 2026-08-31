"use strict";
// ---------------------------------------------------------------------------
// schema.ts — Stage 1: schema validation + shorthand expansion
// ---------------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.NODE_TYPES = void 0;
exports.validateSceneGraph = validateSceneGraph;
const errors_js_1 = require("./errors.js");
// ─── Node Types ───────────────────────────────────────────────────────────────
exports.NODE_TYPES = [
    "FRAME",
    "TEXT",
    "INSTANCE",
    "CLONE",
    "RECTANGLE",
    "ELLIPSE",
    "REPEAT",
    "CONDITIONAL",
    "COMPONENT",
    "COMPONENT_SET",
];
const COMPONENT_PROPERTY_TYPES = ["TEXT", "BOOLEAN", "INSTANCE_SWAP"];
const BIND_FIELDS = ["characters", "visible", "mainComponent"];
// ─── Allowed enum values ──────────────────────────────────────────────────────
const LAYOUT_MODES = ["HORIZONTAL", "VERTICAL", "NONE"];
const SIZING_MODES = ["AUTO", "FIXED"];
const PRIMARY_AXIS_ALIGNS = ["MIN", "CENTER", "MAX", "SPACE_BETWEEN"];
const COUNTER_AXIS_ALIGNS = ["MIN", "CENTER", "MAX"];
const STROKE_ALIGNS = ["INSIDE", "OUTSIDE", "CENTER"];
const AUTO_RESIZE_MODES = ["HEIGHT", "WIDTH_AND_HEIGHT", "NONE"];
// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Narrow unknown to a plain object record. */
function isObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}
/** Indexed access to an arbitrary object-like value. */
function field(obj, key) {
    return isObject(obj) ? obj[key] : undefined;
}
function missingField(fieldName, nodeName, path) {
    return new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
        message: 'Missing required field "' + fieldName + '" on node "' + nodeName + '"',
        node: nodeName,
        path: path + "." + fieldName,
    });
}
function unknownType(type, nodeName, path) {
    return new errors_js_1.CompilerError("PARSE_UNKNOWN_NODE_TYPE", {
        message: 'Unknown node type "' + type + '"' + (nodeName ? ' on node "' + nodeName + '"' : ""),
        node: nodeName ?? "(unnamed)",
        path: path + ".type",
    });
}
function invalidEnum(fieldName, value, allowed, nodeName, path) {
    return new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
        message: 'Invalid value "' +
            String(value) +
            '" for "' +
            fieldName +
            '" on node "' +
            nodeName +
            '". Allowed: ' +
            allowed.join(", "),
        node: nodeName,
        path: path + "." + fieldName,
    });
}
function checkEnum(fieldName, value, allowed, nodeName, path) {
    if (value !== undefined && allowed.indexOf(value) === -1) {
        return invalidEnum(fieldName, value, allowed, nodeName, path);
    }
    return null;
}
function checkString(fieldName, value, nodeName, path) {
    if (value !== undefined && typeof value !== "string") {
        return new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
            message: 'Field "' + fieldName + '" must be a string on node "' + nodeName + '"',
            node: nodeName,
            path: path + "." + fieldName,
        });
    }
    return null;
}
function checkNumber(fieldName, value, nodeName, path) {
    if (value !== undefined && typeof value !== "number") {
        return new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
            message: 'Field "' + fieldName + '" must be a number on node "' + nodeName + '"',
            node: nodeName,
            path: path + "." + fieldName,
        });
    }
    return null;
}
function checkBoolean(fieldName, value, nodeName, path) {
    if (value !== undefined && typeof value !== "boolean") {
        return new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
            message: 'Field "' + fieldName + '" must be a boolean on node "' + nodeName + '"',
            node: nodeName,
            path: path + "." + fieldName,
        });
    }
    return null;
}
// ─── Shorthand Expansion ──────────────────────────────────────────────────────
/**
 * Expand shorthands and apply defaults to a node (mutates the node).
 */
function expandShorthands(node) {
    // Padding shorthand: padding → all four sides
    if (node["padding"] !== undefined) {
        if (node["paddingTop"] === undefined)
            node["paddingTop"] = node["padding"];
        if (node["paddingRight"] === undefined)
            node["paddingRight"] = node["padding"];
        if (node["paddingBottom"] === undefined)
            node["paddingBottom"] = node["padding"];
        if (node["paddingLeft"] === undefined)
            node["paddingLeft"] = node["padding"];
        delete node["padding"];
    }
    // Default visible = true
    if (node["visible"] === undefined) {
        node["visible"] = true;
    }
    // Default strokeAlign = "INSIDE" when stroke is present
    if (node["stroke"] !== undefined && node["strokeAlign"] === undefined) {
        node["strokeAlign"] = "INSIDE";
    }
    // Default autoResize = "HEIGHT" for TEXT nodes
    if (node["type"] === "TEXT" && node["autoResize"] === undefined) {
        node["autoResize"] = "HEIGHT";
    }
    return node;
}
function validateFrame(node, path) {
    const errors = [];
    const name = String(node["name"] ?? "");
    const enumChecks = [
        ["layout", LAYOUT_MODES],
        ["primaryAxisSizing", SIZING_MODES],
        ["counterAxisSizing", SIZING_MODES],
        ["primaryAxisAlign", PRIMARY_AXIS_ALIGNS],
        ["counterAxisAlign", COUNTER_AXIS_ALIGNS],
        ["strokeAlign", STROKE_ALIGNS],
    ];
    for (const [f, allowed] of enumChecks) {
        const e = checkEnum(f, node[f], allowed, name, path);
        if (e)
            errors.push(e);
    }
    const numFields = ["width", "height", "strokeWeight", "opacity"];
    for (const f of numFields) {
        const e = checkNumber(f, node[f], name, path);
        if (e)
            errors.push(e);
    }
    const strFields = [
        "gap",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "radius",
        "radiusTopLeft",
        "radiusTopRight",
        "radiusBottomLeft",
        "radiusBottomRight",
        "fill",
        "stroke",
        "effectStyle",
    ];
    for (const f of strFields) {
        const e = checkString(f, node[f], name, path);
        if (e)
            errors.push(e);
    }
    const boolFields = ["clip", "fillH", "fillV"];
    for (const f of boolFields) {
        const e = checkBoolean(f, node[f], name, path);
        if (e)
            errors.push(e);
    }
    // Recurse into children
    const children = node["children"];
    if (Array.isArray(children)) {
        children.forEach((child, i) => {
            const childErrors = validateNode(child, path + ".children[" + i + "]");
            for (const ce of childErrors)
                errors.push(ce);
        });
    }
    return errors;
}
function validateText(node, path) {
    const errors = [];
    const name = String(node["name"] ?? "");
    const characters = node["characters"];
    if (characters === undefined || characters === null) {
        errors.push(missingField("characters", name, path));
    }
    else if (typeof characters !== "string") {
        errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
            message: 'Field "characters" must be a string on node "' + name + '"',
            node: name,
            path: path + ".characters",
        }));
    }
    if (!node["textStyle"]) {
        errors.push(missingField("textStyle", name, path));
    }
    else {
        const e = checkString("textStyle", node["textStyle"], name, path);
        if (e)
            errors.push(e);
    }
    const e1 = checkEnum("autoResize", node["autoResize"], AUTO_RESIZE_MODES, name, path);
    if (e1)
        errors.push(e1);
    const e2 = checkString("fill", node["fill"], name, path);
    if (e2)
        errors.push(e2);
    const e3 = checkNumber("maxLines", node["maxLines"], name, path);
    if (e3)
        errors.push(e3);
    return errors;
}
function validateInstance(node, path) {
    const errors = [];
    const name = String(node["name"] ?? "");
    if (!node["component"]) {
        errors.push(missingField("component", name, path));
    }
    else {
        const e = checkString("component", node["component"], name, path);
        if (e)
            errors.push(e);
    }
    if (node["variant"] !== undefined && !isObject(node["variant"])) {
        errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
            message: 'Field "variant" must be an object on node "' + name + '"',
            node: name,
            path: path + ".variant",
        }));
    }
    if (node["properties"] !== undefined && !isObject(node["properties"])) {
        errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
            message: 'Field "properties" must be an object on node "' + name + '"',
            node: name,
            path: path + ".properties",
        }));
    }
    if (node["swaps"] !== undefined && !isObject(node["swaps"])) {
        errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
            message: 'Field "swaps" must be an object on node "' + name + '"',
            node: name,
            path: path + ".swaps",
        }));
    }
    errors.push(...validateOverrides(node, path));
    return errors;
}
function validateClone(node, path) {
    const errors = [];
    const name = String(node["name"] ?? "");
    if (!node["sourceNodeId"] && !node["sourceRef"]) {
        errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
            message: 'CLONE node "' + name + '" must have either "sourceNodeId" or "sourceRef"',
            node: name,
            path: path,
        }));
    }
    errors.push(...validateOverrides(node, path));
    return errors;
}
/**
 * `overrides` is shared by CLONE and INSTANCE: both reach descendants the
 * component itself does not expose. Validated in one place so the two node
 * types cannot drift apart.
 */
function validateOverrides(node, path) {
    const errors = [];
    const name = String(node["name"] ?? "");
    const overrides = node["overrides"];
    if (overrides === undefined)
        return errors;
    if (!Array.isArray(overrides)) {
        errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
            message: 'Field "overrides" must be an array on node "' + name + '"',
            node: name,
            path: path + ".overrides",
        }));
        return errors;
    }
    overrides.forEach((override, i) => {
        const oPath = path + ".overrides[" + i + "]";
        const find = field(override, "find");
        if (!find || !field(find, "name")) {
            errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
                message: "Override at " + oPath + ' must have "find.name"',
                node: name,
                path: oPath + ".find.name",
            }));
        }
        const nth = find ? field(find, "nth") : undefined;
        if (nth !== undefined && (typeof nth !== "number" || !Number.isInteger(nth) || nth < 0)) {
            errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
                message: "Override at " + oPath + ' must have a non-negative integer "find.nth" (0-based)',
                node: name,
                path: oPath + ".find.nth",
            }));
        }
        const set = field(override, "set");
        if (!set || !isObject(set)) {
            errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
                message: "Override at " + oPath + ' must have a "set" object',
                node: name,
                path: oPath + ".set",
            }));
        }
    });
    return errors;
}
function validateRectangle(node, path) {
    const errors = [];
    const name = String(node["name"] ?? "");
    if (node["width"] === undefined)
        errors.push(missingField("width", name, path));
    if (node["height"] === undefined)
        errors.push(missingField("height", name, path));
    const numFields = ["width", "height", "strokeWeight"];
    for (const f of numFields) {
        const e = checkNumber(f, node[f], name, path);
        if (e)
            errors.push(e);
    }
    const strFields = ["fill", "stroke", "radius"];
    for (const f of strFields) {
        const e = checkString(f, node[f], name, path);
        if (e)
            errors.push(e);
    }
    const e = checkEnum("strokeAlign", node["strokeAlign"], STROKE_ALIGNS, name, path);
    if (e)
        errors.push(e);
    return errors;
}
function validateEllipse(node, path) {
    const errors = [];
    const name = String(node["name"] ?? "");
    if (node["width"] === undefined)
        errors.push(missingField("width", name, path));
    if (node["height"] === undefined)
        errors.push(missingField("height", name, path));
    const numFields = ["width", "height", "strokeWeight"];
    for (const f of numFields) {
        const e = checkNumber(f, node[f], name, path);
        if (e)
            errors.push(e);
    }
    const strFields = ["fill", "stroke"];
    for (const f of strFields) {
        const e = checkString(f, node[f], name, path);
        if (e)
            errors.push(e);
    }
    return errors;
}
function validateRepeat(node, path) {
    const errors = [];
    const name = String(node["name"] ?? "");
    if (node["count"] === undefined && node["data"] === undefined) {
        errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
            message: 'REPEAT node "' + name + '" must have either "count" or "data"',
            node: name,
            path: path,
        }));
    }
    if (node["count"] !== undefined) {
        const e = checkNumber("count", node["count"], name, path);
        if (e)
            errors.push(e);
    }
    if (node["data"] !== undefined && !Array.isArray(node["data"])) {
        errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
            message: 'Field "data" must be an array on node "' + name + '"',
            node: name,
            path: path + ".data",
        }));
    }
    const template = node["template"];
    if (!template || !Array.isArray(template) || template.length === 0) {
        errors.push(missingField("template", name, path));
    }
    else {
        template.forEach((child, i) => {
            const childErrors = validateNode(child, path + ".template[" + i + "]");
            for (const ce of childErrors)
                errors.push(ce);
        });
    }
    return errors;
}
function validateConditional(node, path) {
    const errors = [];
    const name = String(node["name"] ?? "");
    if (!node["when"]) {
        errors.push(missingField("when", name, path));
    }
    else {
        const e = checkString("when", node["when"], name, path);
        if (e)
            errors.push(e);
    }
    const children = node["children"];
    if (!children || !Array.isArray(children) || children.length === 0) {
        errors.push(missingField("children", name, path));
    }
    else {
        children.forEach((child, i) => {
            const childErrors = validateNode(child, path + ".children[" + i + "]");
            for (const ce of childErrors)
                errors.push(ce);
        });
    }
    const elseBranch = node["else"];
    if (elseBranch !== undefined) {
        if (!Array.isArray(elseBranch)) {
            errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
                message: 'Field "else" must be an array on node "' + name + '"',
                node: name,
                path: path + ".else",
            }));
        }
        else {
            elseBranch.forEach((child, i) => {
                const childErrors = validateNode(child, path + ".else[" + i + "]");
                for (const ce of childErrors)
                    errors.push(ce);
            });
        }
    }
    return errors;
}
/**
 * Shared validator for the `componentProperties` array carried by COMPONENT
 * and COMPONENT_SET nodes.
 */
function validateComponentProperties(node, path, name) {
    const errors = [];
    const props = node["componentProperties"];
    if (props === undefined)
        return errors;
    if (!Array.isArray(props)) {
        errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
            message: 'Field "componentProperties" must be an array on node "' + name + '"',
            node: name,
            path: path + ".componentProperties",
        }));
        return errors;
    }
    props.forEach((prop, i) => {
        const pPath = path + ".componentProperties[" + i + "]";
        const pName = field(prop, "name");
        const pType = field(prop, "type");
        if (!pName || typeof pName !== "string") {
            errors.push(missingField("name", name, pPath));
        }
        if (!pType || typeof pType !== "string") {
            errors.push(missingField("type", name, pPath));
        }
        else if (COMPONENT_PROPERTY_TYPES.indexOf(pType) === -1) {
            errors.push(invalidEnum("type", pType, COMPONENT_PROPERTY_TYPES, name, pPath));
        }
        const bindTo = field(prop, "bindTo");
        if (bindTo !== undefined) {
            if (!isObject(bindTo)) {
                errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
                    message: 'Field "bindTo" must be an object at ' + pPath,
                    node: name,
                    path: pPath + ".bindTo",
                }));
            }
            else {
                if (!bindTo["layer"] || typeof bindTo["layer"] !== "string") {
                    errors.push(missingField("layer", name, pPath + ".bindTo"));
                }
                const bField = bindTo["field"];
                if (bField !== undefined && BIND_FIELDS.indexOf(String(bField)) === -1) {
                    errors.push(invalidEnum("field", bField, BIND_FIELDS, name, pPath + ".bindTo"));
                }
            }
        }
    });
    return errors;
}
/**
 * A COMPONENT is a master. Structurally it behaves like a FRAME — same layout,
 * padding and fill vocabulary — so frame validation is reused wholesale.
 */
function validateComponent(node, path) {
    const name = String(node["name"] ?? "");
    const errors = validateFrame(node, path);
    const variantValues = node["variantValues"];
    if (variantValues !== undefined && !isObject(variantValues)) {
        errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
            message: 'Field "variantValues" must be an object on node "' + name + '"',
            node: name,
            path: path + ".variantValues",
        }));
    }
    for (const e of validateComponentProperties(node, path, name))
        errors.push(e);
    return errors;
}
/**
 * A COMPONENT_SET is a container of COMPONENT variants. It declares the axes,
 * and every child must state its value on each of them.
 */
function validateComponentSet(node, path) {
    const errors = [];
    const name = String(node["name"] ?? "");
    const axes = node["variantProperties"];
    if (!Array.isArray(axes) || axes.length === 0) {
        errors.push(missingField("variantProperties", name, path));
    }
    else {
        axes.forEach((axis, i) => {
            const aPath = path + ".variantProperties[" + i + "]";
            const aName = field(axis, "name");
            const aValues = field(axis, "values");
            if (!aName || typeof aName !== "string") {
                errors.push(missingField("name", name, aPath));
            }
            if (!Array.isArray(aValues) || aValues.length === 0) {
                errors.push(missingField("values", name, aPath));
            }
        });
    }
    const children = node["children"];
    if (!Array.isArray(children) || children.length === 0) {
        errors.push(missingField("children", name, path));
        return errors;
    }
    const axisNames = Array.isArray(axes)
        ? axes.map((a) => field(a, "name")).filter((n) => typeof n === "string")
        : [];
    const seen = new Set();
    children.forEach((child, i) => {
        const cPath = path + ".children[" + i + "]";
        if (field(child, "type") !== "COMPONENT") {
            errors.push(new errors_js_1.CompilerError("PARSE_UNKNOWN_NODE_TYPE", {
                message: 'COMPONENT_SET "' +
                    name +
                    '" may only contain COMPONENT children, got "' +
                    String(field(child, "type")) +
                    '" at ' +
                    cPath,
                node: name,
                path: cPath + ".type",
            }));
            return;
        }
        for (const ce of validateNode(child, cPath))
            errors.push(ce);
        // Every variant must pin every axis, otherwise Figma cannot place it in
        // the matrix and silently produces a malformed set.
        const values = field(child, "variantValues");
        if (!isObject(values)) {
            errors.push(missingField("variantValues", name, cPath));
            return;
        }
        for (const axisName of axisNames) {
            if (values[axisName] === undefined) {
                errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
                    message: "Variant at " +
                        cPath +
                        ' is missing a value for axis "' +
                        axisName +
                        '" declared on COMPONENT_SET "' +
                        name +
                        '"',
                    node: name,
                    path: cPath + ".variantValues." + axisName,
                }));
            }
        }
        const signature = axisNames.map((a) => a + "=" + String(values[a])).join(", ");
        if (seen.has(signature)) {
            errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
                message: 'COMPONENT_SET "' + name + '" has two variants with the same combination: ' + signature,
                node: name,
                path: cPath + ".variantValues",
            }));
        }
        seen.add(signature);
    });
    for (const e of validateComponentProperties(node, path, name))
        errors.push(e);
    return errors;
}
const TYPE_VALIDATORS = {
    FRAME: validateFrame,
    TEXT: validateText,
    INSTANCE: validateInstance,
    CLONE: validateClone,
    RECTANGLE: validateRectangle,
    ELLIPSE: validateEllipse,
    REPEAT: validateRepeat,
    CONDITIONAL: validateConditional,
    COMPONENT: validateComponent,
    COMPONENT_SET: validateComponentSet,
};
/**
 * Validate a single node: check common fields, dispatch to type-specific validator.
 */
function validateNode(node, path) {
    const errors = [];
    if (!isObject(node)) {
        errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
            message: "Node at " + path + " must be an object",
            node: "(invalid)",
            path: path,
        }));
        return errors;
    }
    const raw = node;
    const rawType = raw["type"];
    const rawName = typeof raw["name"] === "string" ? raw["name"] : undefined;
    if (!rawType) {
        errors.push(missingField("type", rawName ?? "(unnamed)", path));
        return errors;
    }
    if (typeof rawType !== "string" || exports.NODE_TYPES.indexOf(rawType) === -1) {
        errors.push(unknownType(String(rawType), rawName, path));
        return errors;
    }
    if (!rawName) {
        errors.push(missingField("name", "(unnamed)", path));
    }
    // Expand shorthands and apply defaults before type-specific validation
    expandShorthands(raw);
    const displayName = rawName ?? "(unnamed)";
    // Common optional field checks
    const e1 = checkBoolean("visible", raw["visible"], displayName, path);
    if (e1)
        errors.push(e1);
    const e2 = checkNumber("opacity", raw["opacity"], displayName, path);
    if (e2)
        errors.push(e2);
    const e3 = checkBoolean("fillH", raw["fillH"], displayName, path);
    if (e3)
        errors.push(e3);
    const e4 = checkBoolean("fillV", raw["fillV"], displayName, path);
    if (e4)
        errors.push(e4);
    // Dispatch to type-specific validator
    const typeValidator = TYPE_VALIDATORS[rawType];
    const typeErrors = typeValidator(raw, path);
    for (const te of typeErrors)
        errors.push(te);
    return errors;
}
/**
 * Validate a complete scene graph JSON document.
 */
function validateSceneGraph(json) {
    const errors = [];
    // Must be an object
    if (!isObject(json)) {
        errors.push(new errors_js_1.CompilerError("PARSE_INVALID_JSON", {
            message: "Scene graph must be a JSON object",
            node: null,
            path: "",
        }));
        return { valid: false, errors, graph: null };
    }
    const root = json;
    // version
    if (root["version"] !== "3.0") {
        errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
            message: 'Scene graph must have version "3.0", got "' + String(root["version"]) + '"',
            node: null,
            path: "version",
        }));
    }
    // metadata
    const metadata = root["metadata"];
    if (!isObject(metadata)) {
        errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
            message: 'Scene graph must have a "metadata" object',
            node: null,
            path: "metadata",
        }));
    }
    else {
        if (!metadata["name"]) {
            errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
                message: "metadata.name is required",
                node: null,
                path: "metadata.name",
            }));
        }
        if (typeof metadata["width"] !== "number") {
            errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
                message: "metadata.width is required and must be a number",
                node: null,
                path: "metadata.width",
            }));
        }
        if (typeof metadata["height"] !== "number") {
            errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
                message: "metadata.height is required and must be a number",
                node: null,
                path: "metadata.height",
            }));
        }
    }
    // fonts
    const fonts = root["fonts"];
    if (!Array.isArray(fonts)) {
        errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
            message: 'Scene graph must have a "fonts" array',
            node: null,
            path: "fonts",
        }));
    }
    else {
        fonts.forEach((font, i) => {
            const family = field(font, "family");
            const style = field(font, "style");
            if (!family || typeof family !== "string") {
                errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
                    message: "fonts[" + i + "].family is required and must be a string",
                    node: null,
                    path: "fonts[" + i + "].family",
                }));
            }
            if (!style || typeof style !== "string") {
                errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
                    message: "fonts[" + i + "].style is required and must be a string",
                    node: null,
                    path: "fonts[" + i + "].style",
                }));
            }
        });
    }
    // nodes
    const nodes = root["nodes"];
    if (!Array.isArray(nodes)) {
        errors.push(new errors_js_1.CompilerError("PARSE_MISSING_FIELD", {
            message: 'Scene graph must have a "nodes" array',
            node: null,
            path: "nodes",
        }));
    }
    else {
        nodes.forEach((node, i) => {
            const nodeErrors = validateNode(node, "nodes[" + i + "]");
            for (const ne of nodeErrors)
                errors.push(ne);
        });
    }
    return {
        valid: errors.length === 0,
        errors,
        graph: errors.length === 0 ? json : null,
    };
}
//# sourceMappingURL=schema.js.map