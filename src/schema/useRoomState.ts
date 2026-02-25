import { Schema } from "@colyseus/schema";
import { Room, SchemaSerializer } from "@colyseus/sdk";
import { Snapshot } from './createSnapshot';
import { useColyseusState } from './useColyseusState';

/**
 * React hook that provides immutable snapshots of Colyseus room state
 * with structural sharing to minimize re-renders.
 *
 * This hook subscribes to state changes from the room's Colyseus decoder
 * and produces plain JavaScript snapshots of the state. Unchanged portions
 * of the state tree maintain referential equality between renders, enabling
 * efficient React component updates.
 *
 * @template State - The root Schema type of the room state
 * @template U - The selected portion of state (defaults to full state)
 *
 * @param room - The Colyseus room instance whose state should be snapshotted
 * @param selector - Optional function to select a portion of the state
 *
 * @returns The snapshotted, immutable state
 *
 * @example
 * ```tsx
 * // Use the full state
 * const state = useRoomState(room);
 *
 * // Use with a selector to only subscribe to part of the state
 * const players = useRoomState(room, (s) => s.players);
 * ```
 */
export function useRoomState<State extends Schema, U = State>(
    room: Room<any, State> | null | undefined,
    selector: (state: State) => U = (s) => s as unknown as U
): Snapshot<U> | undefined {
    const serializer = room?.serializer as SchemaSerializer<State> | undefined;

    return useColyseusState(room?.state, serializer?.decoder, selector);
}
