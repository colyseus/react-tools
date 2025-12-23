// import { Schema } from "@colyseus/schema";
// import { Room } from "colyseus.js";
// import { Snapshot } from './createSnapshot';
// import { useColyseusState } from './useColyseusState';
// /*
//  * Convenience wrapper for use with a Colyseus Room instance.
//  * 
//  * This requires a dependency on colyseus.js (not just @colyseus/schema).
//  * Uncomment and add the dependency if you want to use this version.
//  *
//  * @example
//  * ```tsx
//  * const state = useRoomState(room);
//  * const players = useRoomState(room, (s) => s.players);
//  * ```
//  *
//  */
// export function useRoomState<T extends Schema = Schema, U = T>(
//     room: Room<T> | undefined,
//     selector: (state: T) => U = (s) => s as unknown as U
// ): Snapshot<U> | undefined {
//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     const decoder = (room as any)?.serializer?.decoder;
//     return useColyseusState(room?.state, decoder, selector);
// }
