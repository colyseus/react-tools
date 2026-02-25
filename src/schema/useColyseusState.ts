import { Schema, Decoder } from "@colyseus/schema";
import { useCallback, useRef, useSyncExternalStore, useEffect } from "react";
import { createSnapshot, Snapshot, SnapshotContext } from './createSnapshot';
import { getOrCreateSubscription } from './getOrCreateSubscription';

/**
 * React hook that provides immutable snapshots of Colyseus room state
 * with structural sharing to minimize re-renders.
 * 
 * This hook subscribes to state changes from the Colyseus decoder and
 * produces plain JavaScript snapshots of the state. Unchanged portions
 * of the state tree maintain referential equality between renders, enabling
 * efficient React component updates.
 * 
 * @template T - The root Schema type of the room state
 * @template U - The selected portion of state (defaults to full state)
 * 
 * @param roomState - The Colyseus room state Schema instance
 * @param decoder - The Colyseus Decoder associated with the room
 * @param selector - Optional function to select a portion of the state
 * 
 * @returns The snapshotted, immutable state
 * 
 * @example
 * ```tsx
 * // Use the full state
 * const state = useColyseusState(room.state, decoder);
 * 
 * // Use with a selector to only subscribe to part of the state
 * const players = useColyseusState(room.state, decoder, (s) => s.players);
 * ```
 */
export function useColyseusState<T extends Schema, U = T>(
    roomState?: T,
    decoder?: Decoder<T>,
    selector: (state: T) => U = (s) => s as unknown as U
): Snapshot<U> {
    // Ensure subscription is set up (side effect for StrictMode compatibility).
    useEffect(() => {
        if (roomState && decoder) {
            getOrCreateSubscription(roomState, decoder);
        }
    }, [roomState, decoder]);

    // Keep selector ref up to date so that getSnapshot can use the latest selector
    // without needing to be reassigned.
    const selectorRef = useRef(selector);
    selectorRef.current = selector;

    // The getSnapshot callback is stable, and only changes when roomState/decoder change,
    // preventing useSyncExternalStore from treating every render as a new store.
    const getSnapshot = useCallback(() => {
        if (!roomState || !decoder) {
            return undefined as Snapshot<U>;
        }

        const subscription = getOrCreateSubscription(roomState, decoder);
        const selectedState = selectorRef.current(roomState);

        // Create context for this snapshot pass.
        const ctx: SnapshotContext = {
            refs: decoder.root?.refs,
            objectToRefId: subscription.objectToRefId,
            previousResultsByRefId: subscription.previousResultsByRefId,
            currentResultsByRefId: new Map(),
            dirtyRefIds: subscription.dirtyRefIds,
            parentRefIdMap: subscription.parentRefIdMap,
            currentParentRefId: -1, // No parent for root
        };

        const result = createSnapshot(selectedState, ctx);

        // Update cached results for the next render.
        for (const [refId, value] of ctx.currentResultsByRefId) {
            subscription.previousResultsByRefId.set(refId, value);
        }

        // Save the objectToRefId map for reuse.
        subscription.objectToRefId = ctx.objectToRefId;

        // Periodically prune stale cache entries (every 100 snapshots).
        if (++subscription.cleanupCounter >= 100 && ctx.refs) {
            subscription.cleanupCounter = 0;
            for (const refId of subscription.previousResultsByRefId.keys()) {
                if (!ctx.refs.has(refId)) {
                    subscription.previousResultsByRefId.delete(refId);
                    subscription.parentRefIdMap.delete(refId);
                }
            }
        }

        return result;
    }, [roomState, decoder]);

    // The subscribe callback is stable, and only changes when roomState/decoder change,
    // so React does not re-subscribe (and risk missing notifications) on every render.
    const subscribe = useCallback((callback: () => void) => {
        if (!roomState || !decoder) {
            return () => { };
        }

        const subscription = getOrCreateSubscription(roomState, decoder);
        subscription.listeners.add(callback);
        return () => subscription.listeners.delete(callback);
    }, [roomState, decoder]);

    return useSyncExternalStore(subscribe, getSnapshot);
}
