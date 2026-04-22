/* eslint-disable @typescript-eslint/no-explicit-any */
import { Schema, Decoder, type DataChange, type IRef, type Iterator } from "@colyseus/schema";

/**
 * Subscription state for a single room, shared across all hook instances
 * consuming the same room state.
 */
export interface StateSubscription {
    /** Set of callbacks to invoke when state changes */
    listeners: Set<() => void>;
    /** Cached snapshot results keyed by refId (persistent across passes) */
    resultsByRefId: Map<number, any>;
    /** Reusable "visited this pass" set for cycle detection */
    visitedThisPass: Set<number>;
    /** Set of refIds that have been modified since the last snapshot */
    dirtyRefIds: Set<number>;
    /** Map of childRefId → parentRefId for ancestor tracking */
    parentRefIdMap: Map<number, number>;
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
        resultsByRefId: new Map(),
        visitedThisPass: new Set(),
        dirtyRefIds: new Set(),
        parentRefIdMap: new Map(),
        cleanupCounter: 0,
        originalDecode: decoder.decode,
    };

    // Wrap the decoder's decode method to intercept all state changes.
    // decode() is the single entry point for both full state syncs and
    // incremental patches, and it calls triggerChanges internally before
    // returning. By wrapping decode, we run our notification logic after
    // the entire decode + triggerChanges + GC cycle completes.
    decoder.decode = function (this: Decoder, ...args: [Uint8Array, Iterator, IRef]) {
        // Clear dirty refs after each decode.
        subscription.dirtyRefIds.clear();

        const changes: DataChange[] = subscription.originalDecode.apply(decoder, args);

        if (changes && changes.length > 0) {
            const dirty = subscription.dirtyRefIds;
            const parents = subscription.parentRefIdMap;

            // Mark changed refIds dirty and walk up the parent chain.
            // `change.refId` is provided directly by the decoder, so no
            // reverse lookup map is needed.
            for (let i = 0; i < changes.length; i++) {
                let currentRefId: number | undefined = changes[i].refId;
                while (currentRefId !== undefined && !dirty.has(currentRefId)) {
                    dirty.add(currentRefId);
                    currentRefId = parents.get(currentRefId);
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
