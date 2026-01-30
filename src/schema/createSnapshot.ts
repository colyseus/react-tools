/* eslint-disable @typescript-eslint/no-explicit-any */
import { Schema, ArraySchema, MapSchema } from "@colyseus/schema";

/**
 * Remove function properties from a type.
 */
type OmitFunctions<T> = Omit<T, {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T]>;

/**
 * Recursively applies `readonly` to all properties of a type.
 */
type DeepReadonly<T> = T extends (infer R)[]
    ? ReadonlyArray<DeepReadonly<R>>
    : T extends Record<string, any>
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/**
 * Transforms a Colyseus Schema type into an immutable, plain JavaScript type.
 * 
 * - `ArraySchema<T>` becomes `readonly T[]`
 * - `MapSchema<T>` becomes `Readonly<Record<string, T>>`
 * - `Schema` subclasses become plain objects with only data properties
 * - Primitives remain unchanged
 * 
 * @template T - The Colyseus Schema type to snapshot
 */
export type Snapshot<T> = DeepReadonly<
    T extends ArraySchema<infer U>
    ? Snapshot<U>[]
    : T extends MapSchema<infer U>
    ? Record<string, Snapshot<U>>
    : T extends Schema
    ? { [K in keyof OmitFunctions<T>]: Snapshot<OmitFunctions<T>[K]> }
    : T
>;

/**
 * Context passed through the snapshot recursion.
 */
export interface SnapshotContext {
    /** Map of refId → Schema object from decoder.root.refs */
    refs: Map<number, any> | undefined;
    /** Reverse lookup: Schema object → refId (built lazily) */
    objectToRefId: Map<object, number> | undefined;
    /** Snapshot results from the previous render pass */
    previousResultsByRefId: Map<number, any>;
    /** Snapshot results from the current render pass (for cycle detection) */
    currentResultsByRefId: Map<number, any>;
    /** Set of refIds that have been modified since the last snapshot */
    dirtyRefIds: Set<number>;
    /** Map of childRefId → parentRefId for ancestor tracking */
    parentRefIdMap: Map<number, number>;
    /** Current parent refId during traversal (used to build parentRefIdMap) */
    currentParentRefId: number;
}

/**
 * Builds a reverse lookup map from objects to their refIds.
 */
function buildObjectToRefIdMap(refs: Map<number, any>): Map<object, number> {
    const map = new Map<object, number>();
    for (const [refId, obj] of refs.entries()) {
        if (obj !== null && typeof obj === "object") {
            map.set(obj, refId);
        }
    }
    return map;
}

/**
 * Finds the refId for a Schema object using the reverse lookup map.
 * 
 * In Colyseus 3.x, each Schema instance is assigned a unique numeric refId
 * that remains stable across encode/decode cycles. This allows us to track
 * object identity even when the JavaScript object references change.
 * 
 * @param node - The Schema object to find the refId for
 * @param ctx - The snapshot context with the reverse lookup map
 * @returns The refId if found, or -1 if not found
 */
function findRefId(node: object, ctx: SnapshotContext): number {
    if (!ctx.refs) return -1;
    
    // Build the reverse lookup map lazily on first use.
    if (!ctx.objectToRefId) {
        ctx.objectToRefId = buildObjectToRefIdMap(ctx.refs);
    }
    
    return ctx.objectToRefId.get(node) ?? -1;
}

/**
 * Creates a snapshot of a MapSchema into a plain JavaScript object with structural sharing.
 */
function createSnapshotForMapSchema(
    node: MapSchema<any>,
    previousResult: Record<string, any> | undefined,
    ctx: SnapshotContext
): Record<string, any> {
    const snapshotted: Record<string, any> = {};
    let hasChanged = previousResult === undefined;

    for (const [key, value] of node) {
        const snapshottedValue = createSnapshot(value, ctx);
        snapshotted[key] = snapshottedValue;

        if (!hasChanged && previousResult) {
            if (!(key in previousResult) || previousResult[key] !== snapshottedValue) {
                hasChanged = true;
            }
        }
    }

    // Check if any keys were removed.
    if (!hasChanged && previousResult) {
        if (Object.keys(previousResult).length !== Object.keys(snapshotted).length) {
            hasChanged = true;
        }
    }

    return hasChanged ? snapshotted : previousResult!;
}

/**
 * Creates a snapshot of an ArraySchema into a plain JavaScript array with structural sharing.
 */
function createSnapshotForArraySchema(
    node: ArraySchema<any>,
    previousResult: any[] | undefined,
    ctx: SnapshotContext
): any[] {
    const length = node.length;
    let hasChanged = !previousResult || !Array.isArray(previousResult) || length !== previousResult.length;

    const snapshotted: any[] = new Array(length);

    for (let i = 0; i < length; i++) {
        const snapshottedValue = createSnapshot(node.at(i), ctx);
        snapshotted[i] = snapshottedValue;

        if (!hasChanged && previousResult && previousResult[i] !== snapshottedValue) {
            hasChanged = true;
        }
    }

    return hasChanged ? snapshotted : previousResult!;
}

/**
 * Creates a snapshot of a Schema object into a plain JavaScript object with structural sharing.
 */
function createSnapshotForSchema(
    node: Schema,
    previousResult: Record<string, any> | undefined,
    ctx: SnapshotContext
): Record<string, any> {
    const snapshotted: Record<string, any> = {};
    let hasChanged = previousResult === undefined;

    // Get Colyseus schema field definitions, if present.
    const fieldDefinitions = (node as any)._definition?.fields;

    if (fieldDefinitions) {
        // Iterate only over @type decorated fields.
        for (const fieldName in fieldDefinitions) {
            const value = (node as any)[fieldName];
            if (typeof value !== "function") {
                const snapshottedValue = createSnapshot(value, ctx);
                snapshotted[fieldName] = snapshottedValue;

                if (!hasChanged && previousResult && previousResult[fieldName] !== snapshottedValue) {
                    hasChanged = true;
                }
            }
        }
    } else {
        // Fallback: iterate over enumerable properties, excluding internals.
        for (const key in node) {
            if (key.startsWith("_") || key.startsWith("$")) {
                // Ignore "private" fields.
                continue;
            }
            const value = (node as any)[key];
            if (typeof value !== "function") {
                const snapshottedValue = createSnapshot(value, ctx);
                snapshotted[key] = snapshottedValue;

                if (!hasChanged && previousResult && previousResult[key] !== snapshottedValue) {
                    hasChanged = true;
                }
            }
        }
    }

    return hasChanged ? snapshotted : previousResult!;
}

/**
 * Recursively creates a snapshot of a Colyseus Schema node into plain JavaScript objects.
 * 
 * This function implements structural sharing: if a node and all its descendants
 * are unchanged from the previous render, the previous snapshot result is reused.
 * This ensures referential equality for unchanged subtrees, allowing React memoization.
 * 
 * @param node - The value to snapshot (may be a Schema, primitive, etc.)
 * @param ctx - The snapshot context with refs and previous results
 * @returns The snapshotted plain JavaScript value
 */
export function createSnapshot<T>(node: T, ctx: SnapshotContext): Snapshot<T> {
    // Pass through primitives and null/undefined.
    if (node === null || node === undefined || typeof node !== "object") {
        return node as Snapshot<T>;
    }

    // Find the stable refId for this object.
    const refId = findRefId(node, ctx);

    // Record the parent relationship for ancestor tracking.
    if (refId !== -1 && ctx.currentParentRefId !== -1) {
        ctx.parentRefIdMap.set(refId, ctx.currentParentRefId);
    }

    // Check if we've already snapshotted this object in the current pass (cycle detection).
    if (refId !== -1 && ctx.currentResultsByRefId.has(refId)) {
        return ctx.currentResultsByRefId.get(refId);
    }

    // Get the previous result for structural sharing comparison.
    const previousResult = refId !== -1 ? ctx.previousResultsByRefId.get(refId) : undefined;

    // If this node is not dirty and we have a previous result,
    // we can skip the entire subtree. With ancestor tracking, if any descendant
    // changed, this node would have been marked dirty too.
    if (refId !== -1 && previousResult !== undefined && !ctx.dirtyRefIds.has(refId)) {
        ctx.currentResultsByRefId.set(refId, previousResult);
        return previousResult as Snapshot<T>;
    }

    // Set this node as the parent for any children we process.
    const savedParentRefId = ctx.currentParentRefId;
    ctx.currentParentRefId = refId;

    let result: any;

    if (node instanceof MapSchema) {
        result = createSnapshotForMapSchema(node, previousResult, ctx);
    } else if (node instanceof ArraySchema) {
        result = createSnapshotForArraySchema(node, previousResult, ctx);
    } else if (node instanceof Schema) {
        result = createSnapshotForSchema(node, previousResult, ctx);
    } else {
        // Plain object or unknown type - pass through.
        result = node;
    }

    // Restore parent and cache result.
    ctx.currentParentRefId = savedParentRefId;
    if (refId !== -1) {
        ctx.currentResultsByRefId.set(refId, result);
    }

    return result as Snapshot<T>;
}
