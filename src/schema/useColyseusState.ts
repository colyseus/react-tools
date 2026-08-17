import { Schema, Decoder } from "@colyseus/schema";
import { useCallback, useRef, useSyncExternalStore, useEffect } from "react";
import { createSnapshot, Snapshot, SnapshotContext } from './createSnapshot';
import { getOrCreateSubscription } from './getOrCreateSubscription';

// Room objects are not serialized from the server for hydration. Returning a
// stable empty value keeps the server and hydration snapshots identical.
const getServerSnapshot = () => undefined;

function structurallyShareDerivedSnapshot(previous: unknown, next: unknown): unknown {
    if (Object.is(previous, next)) return previous;

    if (Array.isArray(previous) && Array.isArray(next)) {
        if (previous.length !== next.length) return next;

        let changed = false;
        const shared = next.map((value, index) => {
            const result = structurallyShareDerivedSnapshot(previous[index], value);
            if (!Object.is(result, previous[index])) changed = true;
            return result;
        });

        return changed ? shared : previous;
    }

    if (isPlainObject(previous) && isPlainObject(next)) {
        const previousKeys = Object.keys(previous);
        const nextKeys = Object.keys(next);
        if (previousKeys.length !== nextKeys.length) return next;

        let changed = false;
        const shared: Record<string, unknown> = {};
        for (const key of nextKeys) {
            if (!Object.prototype.hasOwnProperty.call(previous, key)) return next;
            const result = structurallyShareDerivedSnapshot(previous[key], next[key]);
            if (!Object.is(result, previous[key])) changed = true;
            shared[key] = result;
        }

        return changed ? shared : previous;
    }

    return next;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object') return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

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

    // `createSnapshot` caches Schema containers by refId. Selector-created root
    // arrays and objects have no refId, so keep their structurally shared result
    // local to this hook to satisfy useSyncExternalStore's stable-snapshot contract.
    const derivedSnapshotRef = useRef<{
        roomState: T;
        decoder: Decoder<T>;
        value: Snapshot<U>;
    }>();

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

        const result = createSnapshot(selectedState, ctx);
        const isDerivedContainer = selectedState !== null
            && typeof selectedState === 'object'
            && typeof (selectedState as Record<string, unknown>)['~refId'] !== 'number';
        const previous = derivedSnapshotRef.current;
        const sharedResult = isDerivedContainer
            && previous?.roomState === roomState
            && previous.decoder === decoder
            ? structurallyShareDerivedSnapshot(previous.value, result) as Snapshot<U>
            : result;
        derivedSnapshotRef.current = { roomState, decoder, value: sharedResult };

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

        return sharedResult;
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
