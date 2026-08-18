import { Schema, Decoder } from "@colyseus/schema";
import { useCallback, useRef, useSyncExternalStore, useEffect } from "react";
import { createSnapshot, getRefId, Snapshot, SnapshotContext } from './createSnapshot';
import { getOrCreateSubscription } from './getOrCreateSubscription';

// Room objects are not serialized from the server for hydration. Returning a
// stable empty value keeps the server and hydration snapshots identical.
const getServerSnapshot = () => undefined;

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

    // createSnapshot caches by refId; a container the selector builds has none, so it
    // would hand back a fresh reference per call — an unstable useSyncExternalStore snapshot.
    const derivedRootRef = useRef<{ roomState: T; decoder: Decoder<T>; value: Snapshot<U> }>();

    // The getSnapshot callback is stable, and only changes when roomState/decoder change,
    // preventing useSyncExternalStore from treating every render as a new store.
    const getSnapshot = useCallback(() => {
        if (!roomState || !decoder) {
            return undefined as Snapshot<U>;
        }

        const subscription = getOrCreateSubscription(roomState, decoder);
        const selectedState = selectorRef.current(roomState);

        // Reuse the persistent "visited" set; its contents from the previous
        // pass are stale, so clear before the walk.
        subscription.visitedThisPass.clear();

        const ctx: SnapshotContext = {
            refs: decoder.root?.refs,
            resultsByRefId: subscription.resultsByRefId,
            visitedThisPass: subscription.visitedThisPass,
            dirtyRefIds: subscription.dirtyRefIds,
            parentRefIdMap: subscription.parentRefIdMap,
            currentParentRefId: -1, // No parent for root
        };

        // A container the selector built has no refId, so hand its previous result
        // down explicitly — that is the only reuse the cache cannot supply.
        const previous = derivedRootRef.current;
        const isDerivedRoot = selectedState !== null
            && typeof selectedState === 'object'
            && getRefId(selectedState) === -1;

        const result = createSnapshot(
            selectedState,
            ctx,
            isDerivedRoot && previous?.roomState === roomState && previous.decoder === decoder
                ? previous.value
                : undefined
        );

        if (isDerivedRoot) {
            derivedRootRef.current = { roomState, decoder, value: result };
        }

        // Periodically prune stale cache entries (every 100 snapshots).
        if (++subscription.cleanupCounter >= 100 && ctx.refs) {
            subscription.cleanupCounter = 0;
            const refs = ctx.refs;
            for (const refId of subscription.resultsByRefId.keys()) {
                if (!refs.has(refId)) {
                    subscription.resultsByRefId.delete(refId);
                    subscription.dirtyRefIds.delete(refId);
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

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) as Snapshot<U>;
}
