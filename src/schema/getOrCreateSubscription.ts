/* eslint-disable @typescript-eslint/no-explicit-any */
import { Schema, Decoder, type DataChange, type IRef, type Iterator } from "@colyseus/schema";

/**
 * Subscription state for a single room, shared across all hook instances
 * consuming the same room state.
 */
export interface StateSubscription {
    /** Set of callbacks to invoke when state changes */
    listeners: Set<() => void>;
    /** Cached snapshot results from the previous render, keyed by refId */
    previousResultsByRefId: Map<number, any>;
    /** Set of refIds that have been modified since the last snapshot */
    dirtyRefIds: Set<number>;
    /** Map of childRefId → parentRefId for ancestor tracking */
    parentRefIdMap: Map<number, number>;
    /** Reverse lookup: Schema object → refId (rebuilt on each change) */
    objectToRefId: Map<object, number> | undefined;
    /** Counter for periodic pruning of stale cache entries */
    cleanupCounter: number;
    /** Original decode function from the decoder */
    originalDecode: (bytes: Uint8Array<ArrayBufferLike>, it?: Iterator, ref?: IRef) => DataChange<any, string>[];
}

/** WeakMap to store subscriptions per room state instance */
const subscriptionsByState = new WeakMap<Schema, StateSubscription>();

/**
 * Gets or creates a subscription for the given room state.
 * 
 * This function sets up change notification by wrapping the decoder's
 * `decode` method to intercept all state changes and notify subscribed
 * React components.
 * 
 * We wrap `decode()` rather than assigning `decoder.triggerChanges` because
 * `triggerChanges` is a single-slot callback that gets unconditionally
 * overwritten by `Callbacks.get()` / `getDecoderStateCallbacks()` on every
 * call. Wrapping `decode()` sidesteps this conflict entirely since it is the
 * sole entry point for both full-state syncs and incremental patches.
 * 
 * @param roomState - The Colyseus room state Schema instance
 * @param decoder - The Colyseus decoder associated with the room
 * @returns The subscription object for this room state
 */
export function getOrCreateSubscription(roomState: Schema, decoder: Decoder): StateSubscription {
    let subscription = subscriptionsByState.get(roomState);

    if (subscription) {
        return subscription;
    }

    subscription = {
        listeners: new Set(),
        previousResultsByRefId: new Map(),
        dirtyRefIds: new Set(),
        parentRefIdMap: new Map(),
        objectToRefId: undefined,
        cleanupCounter: 0,
        originalDecode: decoder.decode,
    };

    // Wrap the decoder's decode method to intercept all state changes.
    // decode() is the single entry point for both full state syncs and
    // incremental patches, and it calls triggerChanges internally before
    // returning. By wrapping decode, we run our notification logic after
    // the entire decode + triggerChanges + GC cycle completes.
    decoder.decode = function (this: Decoder, ...args: [Uint8Array, Iterator, IRef]) {
        const changes: DataChange[] = subscription.originalDecode.apply(decoder, args);

        if (changes && changes.length > 0) {
            // Rebuild reverse lookup since refs may have changed.
            const refs = decoder.root?.refs;
            if (refs) {
                subscription.objectToRefId = new Map();
                for (const [refId, obj] of refs.entries()) {
                    if (obj !== null && typeof obj === "object") {
                        subscription.objectToRefId.set(obj, refId);
                    }
                }
            }

            // Mark all changed refIds as dirty, walking up the parent chain.
            for (const change of changes) {
                const refId = subscription.objectToRefId?.get(change.ref) ?? -1;
                if (refId !== -1) {
                    // Mark this ref and all its ancestors as dirty.
                    let currentRefId: number | undefined = refId;
                    while (currentRefId !== undefined) {
                        subscription.dirtyRefIds.add(currentRefId);
                        currentRefId = subscription.parentRefIdMap.get(currentRefId);
                    }
                }
            }

            // Notify all React subscribers that state has changed.
            subscription.listeners.forEach((callback) => callback());
        }

        return changes;
    };

    subscriptionsByState.set(roomState, subscription);
    return subscription;
}
