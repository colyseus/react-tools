import { Schema, Decoder } from "@colyseus/schema";
import { useSyncExternalStore, useEffect } from "react";
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
export function useColyseusState<T extends Schema = Schema, U = T>(
    roomState: T,
    decoder: Decoder,
    selector: (state: T) => U = (s) => s as unknown as U
): Snapshot<U> {
    // Ensure subscription is set up (side effect for StrictMode compatibility).
    useEffect(() => {
        if (roomState && decoder) {
            getOrCreateSubscription(roomState, decoder);
        }
    }, [roomState, decoder]);

    const getSnapshot = () => {
        if (!roomState || !decoder) {
            return undefined as Snapshot<U>;
        }

        const subscription = getOrCreateSubscription(roomState, decoder);
        const selectedState = selector(roomState);

        // Create context for this snapshot pass.
        const ctx: SnapshotContext = {
            refs: decoder.root?.refs,
            previousResultsByRefId: subscription.previousResultsByRefId,
            currentResultsByRefId: new Map(),
        };

        const result = createSnapshot(selectedState, ctx);

        // Update cached results for the next render.
        for (const [refId, value] of ctx.currentResultsByRefId) {
            subscription.previousResultsByRefId.set(refId, value);
        }

        return result;
    };

    const subscribe = (callback: () => void) => {
        if (!roomState || !decoder) {
            return () => {};
        }

        const subscription = getOrCreateSubscription(roomState, decoder);
        subscription.listeners.add(callback);
        return () => subscription.listeners.delete(callback);
    };

    return useSyncExternalStore(subscribe, getSnapshot);
}
