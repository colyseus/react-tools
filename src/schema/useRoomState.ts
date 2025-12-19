/* eslint-disable @typescript-eslint/no-explicit-any */
import { Schema, ArraySchema, MapSchema, CallbackProxy, SchemaCallbackProxy } from "@colyseus/schema"
import { useSyncExternalStore, useMemo } from "react";

// Utility type to remove keys from a type if their values are functions.
type OmitFunctions<T> = Omit<T, {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T]>;

// Utility type to make all properties (including nested ones) readonly.
type DeepReadonly<T>
    = T extends (infer R)[] ? ReadonlyArray<DeepReadonly<R>>
        : T extends Record<string, any> ? {
            readonly [K in keyof T]: DeepReadonly<T[K]>;
        }
            : T;

// Utility type to convert Colyseus Schema types to their plain JavaScript equivalents,
// excluding any functions, and making the entire structure readonly.
export type Normalized<T> = DeepReadonly<
    T extends ArraySchema<infer U> ? Normalized<U>[]
        : T extends MapSchema<infer U> ? Record<string, Normalized<U>>
            : T extends Schema ? {
                [K in keyof OmitFunctions<T>]: Normalized<OmitFunctions<T>[K]>;
            }
                : T
>;

type SchemaType = Schema | ArraySchema<any> | MapSchema<any>;
type PathSegment = string | number;
type ProxyGenerator = (node: SchemaType) => CallbackProxy<any>;

// Sentinel value to indicate array element removal
const REMOVE_ARRAY_ELEMENT = Symbol('REMOVE_ARRAY_ELEMENT');

/**
 * Normalize Colyseus schema containers into plain JS structures:
 * - MapSchema → plain object (Record<string, ...>)
 * - ArraySchema → plain array
 * - Schema subclasses → recurse into fields
 */
function normalize<T>(node: T): Normalized<T> {
    if (node instanceof MapSchema) {
        const obj: any = {};
        for (const [key, value] of node) {
            obj[key] = normalize(value);
        }
        return obj as Normalized<T>;
    }

    if (node instanceof ArraySchema) {
        return Array.from(node).map(normalize) as Normalized<T>;
    }

    // Handle Schema instances, but exclude MapSchema/ArraySchema which inherit from it.
    if (node instanceof Schema) {
        const obj: any = {};
        // Iterate over all enumerable properties (including inherited fields from base schemas).
        for (const key in node) {
            const value = (node as Record<string, any>)[key];

            // Exclude functions, normalize everything else.
            if (typeof value !== 'function') {
                obj[key] = normalize(value);
            }
        }
        return obj as Normalized<T>;
    }

    return node as Normalized<T>;
}

/**
 * Recursively attach listeners to Colyseus schema nodes.
 * @param node The Colyseus Schema, ArraySchema, or MapSchema instance.
 * @param getProxy Function to generate a callback proxy for a given node.
 * @param notifyChange Function to trigger a store update.
 * @param getPath Function to dynamically compute the current path to this node.
 */
function attachListeners(
    node: SchemaType,
    getProxy: ProxyGenerator,
    notifyChange: (path: PathSegment[], value: any) => void,
    getPath: () => PathSegment[] = () => []
) {
    // Get the proxy for this specific node.
    const proxyNode = getProxy(node);

    // Handle MapSchema/ArraySchema adds.
    if (proxyNode.onAdd) {
        proxyNode.onAdd((child: any, key: PathSegment) => {
            // Recurse into the new child
            if (child instanceof Schema || child instanceof MapSchema || child instanceof ArraySchema) {
                // When an item is added, we must attach listeners to it so subsequent primitive changes
                // on the *new* item are still granular.
                // For ArraySchema items, we need to compute the index dynamically at callback time
                // since array indices can shift when items are removed.
                if (node instanceof ArraySchema) {
                    attachListeners(child, getProxy, notifyChange, () => {
                        const currentIndex = node.indexOf(child);
                        return [...getPath(), currentIndex];
                    });
                } else {
                    attachListeners(child, getProxy, notifyChange, () => [...getPath(), key]);
                }
            }

            if (node instanceof ArraySchema) {
                // ArraySchema structural change: indices shift, so re-normalize the entire container.
                notifyChange(getPath(), normalize(node));
            } else {
                // MapSchema structural change: keys are stable, so update only the new entry.
                // We re-normalize the new child to ensure the full subtree is immutable.
                notifyChange([...getPath(), key], normalize(child));
            }
        }, true);
    }

    // Handle MapSchema/ArraySchema removals.
    if (proxyNode.onRemove) {
        proxyNode.onRemove((_child: any, key: PathSegment) => {
            if (node instanceof ArraySchema) {
                // ArraySchema removal: signal removal of the specific index.
                // The rebuild function will slice out this element while preserving other references.
                notifyChange([...getPath(), key], REMOVE_ARRAY_ELEMENT);
            } else {
                // MapSchema structural change: key is stable, so update only the removed entry's path with undefined.
                notifyChange([...getPath(), key], undefined);
            }
        });
    }

    // Recurse into initial nested schema fields.
    if (node instanceof MapSchema) {
        for (const [key, value] of node) {
            if (value instanceof Schema || value instanceof MapSchema || value instanceof ArraySchema) {
                // Attach listeners recursively to current children.
                attachListeners(value, getProxy, notifyChange, () => [...getPath(), key]);
            }
        }
    } else if (node instanceof ArraySchema) {
        for (let i = 0; i < node.length; i++) {
            const value = node[i];
            if (value instanceof Schema || value instanceof MapSchema || value instanceof ArraySchema) {
                // Attach listeners recursively to current children.
                // Capture the value (not index) so we can look up its current index dynamically.
                const capturedValue = value;
                attachListeners(value, getProxy, notifyChange, () => {
                    const currentIndex = node.indexOf(capturedValue);
                    return [...getPath(), currentIndex];
                });
            }
        }
    } else if (node instanceof Schema) {
        for (const key in node) {
            const value = (node as Record<string, any>)[key];

            // Recurse if the field is a nested Schema structure.
            if (value instanceof Schema || value instanceof MapSchema || value instanceof ArraySchema) {
                attachListeners(value, getProxy, notifyChange, () => [...getPath(), key]);
            } else if (typeof value !== 'function') {
                // Listen for primitive changes on the Schema itself.
                // Use the proxy to listen to specific primitive keys.
                (proxyNode as any).listen(key, (newValue: any) => {
                    notifyChange([...getPath(), key], normalize(newValue));
                });
            }
        }
    }
}

/**
 * Create a store that tracks immutable snapshots of Colyseus state.
 */
function createColyseusStore<T extends SchemaType, U extends SchemaType = T>(
  roomState: T,
  stateCallbacks: SchemaCallbackProxy<T>,
  selector?: (state: T) => U) {
    if (selector === undefined) {
        selector = (state: T) => (state as any as U);
    }

    // Normalize the initial room state.
    let current: Normalized<U> = normalize(selector(roomState));

    const listeners = new Set<() => void>();

    const notifyChange = (path: PathSegment[], value: any) => {
        // Rebuild only the changed subtree, immutably.
        const rebuild = (obj: any, depth = 0): any => {
            // If we've reached the end of the path, return the new value.
            if (depth === path.length) {
                return value;
            }

            const key = path[depth];
            const isLastSegment = depth === path.length - 1;

            if (Array.isArray(obj)) {
                // Check if this is an array removal at the last path segment
                if (isLastSegment && value === REMOVE_ARRAY_ELEMENT) {
                    // Remove the element at this index, preserving references to other elements
                    return [...obj.slice(0, key as number), ...obj.slice((key as number) + 1)];
                }
                // Array recursion: create a new array, recurse into the child index.
                const newArr = [...obj];
                newArr[key as number] = rebuild(obj[key as number], depth + 1);
                return newArr;
            } else if (obj !== undefined && obj !== null) {
                // Object recursion: create a new object, recurse into the child key.
                return { ...obj, [key]: rebuild(obj[key], depth + 1) };
            }

            return obj;
        };

        current = rebuild(current);
        listeners.forEach(fn => fn());
    };

    // Attach listeners to the root proxy and its current children.
    attachListeners(selector(roomState), stateCallbacks as ProxyGenerator, notifyChange);

    return {
        subscribe: (fn: () => void) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        getSnapshot: () => current,
    };
}

/**
 * Provides React with immutable, normalized snapshots of Colyseus state.
 * @param roomState The state of a Colyseus Room instance.
 * @param stateCallbacks The result of calling getStateCallbacks on that Room.
 * @param selector Optional state filter, allowing this hook to return an immutable copy of only part of the Room state.
 * @returns An immutable, plain JavaScript object/array representing the Colyseus state.
 */
export function useRoomState<T extends SchemaType, U extends SchemaType = T>(
  roomState: T,
  stateCallbacks: SchemaCallbackProxy<T>,
  selector?: (roomState: T) => U
): Normalized<U> {
    // Create the store only once per room. Don't recreate it if the selector changes, to be forgiving if it is unstable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const store = useMemo(() => createColyseusStore(roomState, stateCallbacks, selector), [roomState, stateCallbacks]);

    // Use React's hook to subscribe to this external store.
    return useSyncExternalStore(store.subscribe, store.getSnapshot);
}