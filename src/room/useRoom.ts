import type { InferState } from "@colyseus/shared-types";
import { Room } from "@colyseus/sdk";
import { useState, useRef, useEffect, type DependencyList } from "react";

/**
 * Return type of the useRoom hook.
 */
export interface UseRoomResult<T = any, State = any> {
    /** The connected Room instance, or undefined while connecting or on error. */
    room: Room<T, State> | undefined;
    /** The error if connection failed, or undefined. */
    error: Error | undefined;
    /** True while the connection promise is pending. */
    isConnecting: boolean;
}

interface ConnectionState<T, State> {
    promise: Promise<Room<T, State>>;
    room: Room<T, State> | null;
    trigger: number;
    active: boolean;
}

function depsEqual(a: DependencyList | undefined, b: DependencyList | undefined): boolean {
    if (a === b) return true;
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (!Object.is(a[i], b[i])) return false;
    }
    return true;
}

/**
 * React hook that manages the lifecycle of a Colyseus room connection.
 *
 * Connects to a room by calling the provided callback, handles cleanup
 * on unmount, and supports reconnection when dependencies change.
 * Properly handles React StrictMode's double mount/unmount cycle
 * without creating duplicate connections.
 *
 * @template T - The Room type parameter (room definition type)
 * @template State - The Room state type parameter
 *
 * @param callback - A function returning Promise<Room<T, State>>, or a falsy
 *   value to skip connection. Covers all Colyseus matchmaking methods:
 *   joinOrCreate, join, create, joinById, consumeSeatReservation.
 * @param deps - Optional dependency array. When any value changes,
 *   the old room is left and a new connection is established.
 *   Defaults to [] (connect once).
 *
 * @returns An object containing room, error, and isConnecting.
 *
 * @example
 * ```tsx
 * // joinOrCreate
 * const { room } = useRoom(() => client.joinOrCreate("game_room", options), [roomName]);
 *
 * // joinById
 * const { room } = useRoom(() => client.joinById(roomId, options), [roomId]);
 *
 * // consumeSeatReservation
 * const { room } = useRoom(() => client.consumeSeatReservation(reservation), [reservation]);
 *
 * // Compose with useRoomState for state snapshots
 * const state = useRoomState(room);
 *
 * // Conditional connection
 * const { room } = useRoom(isReady ? () => client.joinOrCreate("game") : null, [isReady]);
 * ```
 */
export function useRoom<T = any, State = InferState<T, never>>(
    callback: (() => Promise<Room<T, State>>) | null | undefined | false,
    deps: DependencyList = []
): UseRoomResult<T, State> {
    const [state, setState] = useState<UseRoomResult<T, State>>({
        room: undefined,
        error: undefined,
        isConnecting: !!callback,
    });

    // Keep callback ref fresh so the effect doesn't depend on it.
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    // Connection state persists across StrictMode remounts.
    const connectionRef = useRef<ConnectionState<T, State> | null>(null);

    // Deferred cleanup timeout handle.
    const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Trigger counter: increments on real deps/callback changes, stays stable on StrictMode remount.
    const shouldConnect = !!callback;
    const prevShouldConnectRef = useRef(shouldConnect);
    const prevDepsRef = useRef<DependencyList>(deps);
    const triggerRef = useRef(0);

    if (
        prevShouldConnectRef.current !== shouldConnect ||
        !depsEqual(prevDepsRef.current, deps)
    ) {
        prevShouldConnectRef.current = shouldConnect;
        prevDepsRef.current = deps;
        triggerRef.current++;
    }

    const trigger = triggerRef.current;

    useEffect(() => {
        // Cancel any pending deferred cleanup (StrictMode remount).
        if (cleanupTimeoutRef.current !== null) {
            clearTimeout(cleanupTimeoutRef.current);
            cleanupTimeoutRef.current = null;
        }

        const cb = callbackRef.current;

        // Falsy callback: clean up and reset.
        if (!cb) {
            const existing = connectionRef.current;
            if (existing) {
                existing.active = false;
                if (existing.room) {
                    existing.room.leave();
                }
                connectionRef.current = null;
            }
            setState({ room: undefined, error: undefined, isConnecting: false });
            return;
        }

        const existing = connectionRef.current;

        if (existing && existing.trigger === trigger) {
            // StrictMode remount: reuse existing connection.
            if (existing.room) {
                setState({ room: existing.room, error: undefined, isConnecting: false });
            }
            // If still connecting, the promise handler will call setState.
        } else {
            // New connection (first mount or deps changed).
            if (existing) {
                existing.active = false;
                if (existing.room) {
                    existing.room.leave();
                }
                // If promise is still pending, the .then handler will
                // call room.leave() when it resolves (active is false).
            }

            const promise = cb();
            const connection: ConnectionState<T, State> = {
                promise,
                room: null,
                trigger,
                active: true,
            };
            connectionRef.current = connection;

            setState({ room: undefined, error: undefined, isConnecting: true });

            promise.then((room) => {
                if (!connection.active) {
                    room.leave();
                    return;
                }
                connection.room = room;
                setState({ room, error: undefined, isConnecting: false });
            }).catch((err) => {
                if (!connection.active) return;
                connectionRef.current = null;
                setState({
                    room: undefined,
                    error: err instanceof Error ? err : new Error(String(err)),
                    isConnecting: false,
                });
            });
        }

        // Deferred cleanup: survives StrictMode (cancelled by synchronous remount).
        return () => {
            cleanupTimeoutRef.current = setTimeout(() => {
                cleanupTimeoutRef.current = null;
                const conn = connectionRef.current;
                if (conn && conn.trigger === trigger) {
                    conn.active = false;
                    if (conn.room) {
                        conn.room.leave();
                    }
                    connectionRef.current = null;
                }
            }, 0);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trigger]);

    return state;
}
