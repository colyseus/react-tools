import { Room, type SeatReservation } from "@colyseus/sdk";
import { useState, useRef, useEffect, type DependencyList } from "react";
import { useRoom } from "./useRoom";
import { useRoomMessage } from "./useRoomMessage";

/**
 * Return type of the useQueueRoom hook.
 */
export interface UseQueueRoomResult<T = any, State = any> {
    /** The match room after the seat has been consumed, undefined otherwise. */
    room: Room<T, State> | undefined;
    /** The queue room while waiting. Undefined before connection and after match is joined. */
    queue: Room | undefined;
    /** Number of clients in the current matchmaking group. */
    clients: number;
    /** The seat reservation, once received from the queue. */
    seat: SeatReservation | undefined;
    /** Connection or matchmaking error. */
    error: Error | undefined;
    /** True while connected to the queue and waiting for a match. */
    isWaiting: boolean;
}

/**
 * React hook that manages the lifecycle of a Colyseus QueueRoom,
 * automatically consuming the seat reservation when a match is found.
 *
 * Handles connecting to the queue room, tracking group size,
 * receiving the seat reservation, sending "confirm", and consuming
 * the seat to join the match room. Cleans up both rooms on unmount.
 *
 * @template T - The match Room type parameter
 * @template State - The match Room state type parameter
 *
 * @param connect - A function returning a promise to the queue room,
 *   or a falsy value to skip connection.
 * @param consume - A function that consumes a seat reservation and
 *   returns a promise to the match room.
 * @param deps - Optional dependency array. When any value changes,
 *   the queue is left and re-joined.
 *
 * @example
 * ```tsx
 * const { room, clients, isWaiting, error } = useQueueRoom(
 *   () => client.joinOrCreate("queue", { rank: 1200 }),
 *   (reservation) => client.consumeSeatReservation(reservation),
 *   [rank]
 * );
 *
 * if (error) return <div>Error: {error.message}</div>;
 * if (room) return <GameScreen room={room} />;
 * if (isWaiting) return <div>Waiting... {clients} players in group</div>;
 * return <div>Connecting...</div>;
 * ```
 */
export function useQueueRoom<T = any, State = any>(
    connect: (() => Promise<Room>) | null | undefined | false,
    consume: (reservation: SeatReservation) => Promise<Room<T, State>>,
    deps: DependencyList = []
): UseQueueRoomResult<T, State> {
    const { room: queue, error: queueError } = useRoom(connect, deps);

    const [state, setState] = useState<{
        clients: number;
        seat: SeatReservation | undefined;
        room: Room<T, State> | undefined;
        error: Error | undefined;
    }>({ clients: 0, seat: undefined, room: undefined, error: undefined });

    const consumeRef = useRef(consume);
    consumeRef.current = consume;

    const consumingRef = useRef(false);
    const matchRoomRef = useRef<Room<T, State> | null>(null);

    // Reset when queue room changes (new connection or deps changed).
    useEffect(() => {
        consumingRef.current = false;

        if (matchRoomRef.current) {
            matchRoomRef.current.leave();
            matchRoomRef.current = null;
        }

        setState({ clients: 0, seat: undefined, room: undefined, error: undefined });
    }, [queue]);

    // Track group size.
    useRoomMessage(queue, "clients", (count: number) => {
        setState(prev => ({ ...prev, clients: count }));
    });

    // Handle seat reservation: confirm and consume.
    useRoomMessage(queue, "seat", (reservation: SeatReservation) => {
        if (consumingRef.current) return;
        consumingRef.current = true;

        setState(prev => ({ ...prev, seat: reservation }));

        queue!.send("confirm");

        consumeRef.current(reservation)
            .then((room) => {
                matchRoomRef.current = room;
                setState(prev => ({ ...prev, room }));
                queue!.leave();
            })
            .catch((err) => {
                consumingRef.current = false;
                setState(prev => ({
                    ...prev,
                    error: err instanceof Error ? err : new Error(String(err)),
                }));
            });
    });

    // Clean up match room on unmount.
    useEffect(() => {
        return () => {
            if (matchRoomRef.current) {
                matchRoomRef.current.leave();
                matchRoomRef.current = null;
            }
        };
    }, []);

    return {
        room: state.room,
        queue: state.room ? undefined : queue,
        clients: state.clients,
        seat: state.seat,
        error: state.error || queueError,
        isWaiting: !!queue && !state.seat && !state.room && !state.error && !queueError,
    };
}
