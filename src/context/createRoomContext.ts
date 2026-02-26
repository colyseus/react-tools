import { useSyncExternalStore, useEffect, type ReactNode, type DependencyList } from "react";
import { Schema } from "@colyseus/schema";
import { Room } from "@colyseus/sdk";
import { useRoom as useRoomLifecycle, type UseRoomResult } from "../room/useRoom";
import { useRoomState as useRoomStateOriginal } from "../schema/useRoomState";
import { useRoomMessage as useRoomMessageStandalone } from "../room/useRoomMessage";
import type { Snapshot } from "../schema/createSnapshot";

interface RoomProviderProps<T, State> {
  connect: (() => Promise<Room<T, State>>) | null | undefined | false;
  deps?: DependencyList;
  children: ReactNode;
}

/**
 * Creates a set of hooks and a Provider for sharing a Colyseus room
 * across React reconciler boundaries (e.g. DOM + React Three Fiber).
 *
 * Uses a closure-scoped external store (not React Context), so hooks
 * work in any reconciler tree that imports them.
 *
 * @template T - The Room type parameter (room definition type)
 * @template State - The Room state type (must extend Schema)
 *
 * @example
 * ```tsx
 * const { RoomProvider, useRoom, useRoomState } = createRoomContext<any, MyState>();
 *
 * // Wrap your app
 * <RoomProvider connect={() => client.joinOrCreate("my_room")}>
 *   <App />
 * </RoomProvider>
 *
 * // In any component (DOM or R3F):
 * const { room } = useRoom();
 * const players = useRoomState((s) => s.players);
 * room.send("action", data);
 * ```
 */
export function createRoomContext<T = any, State extends Schema = Schema>() {
  // Closure-scoped external store — bridges reconciler boundaries.
  let snapshot: UseRoomResult<T, State> = { room: undefined, error: undefined, isConnecting: true };
  const listeners = new Set<() => void>();

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getSnapshot(): UseRoomResult<T, State> {
    return snapshot;
  }

  function setSnapshot(next: UseRoomResult<T, State>) {
    snapshot = next;
    for (const listener of listeners) listener();
  }

  /**
   * Manages the room lifecycle. Render once near the root of your app.
   * State is shared via the closure-scoped external store, not React Context.
   */
  function RoomProvider({ connect, deps = [], children }: RoomProviderProps<T, State>) {
    const { room, error, isConnecting } = useRoomLifecycle<T, State>(connect || null, deps);

    useEffect(() => {
      setSnapshot({ room, error, isConnecting });
    }, [room, error, isConnecting]);

    return children;
  }

  /**
   * Returns the room, error, and connection status.
   * Works in DOM tree, R3F tree, or any other reconciler tree.
   */
  function useRoom(): UseRoomResult<T, State> {
    return useSyncExternalStore(subscribe, getSnapshot);
  }

  /**
   * Returns an immutable snapshot of room state (or a selected slice).
   * No need to pass the room — it's resolved from the store automatically.
   */
  function useRoomState<U = State>(
    selector?: (state: State) => U
  ): Snapshot<U> | undefined {
    const { room } = useSyncExternalStore(subscribe, getSnapshot);
    return useRoomStateOriginal(room, selector);
  }

  /**
   * Subscribes to room messages without needing to pass the room.
   * The room is resolved from the store automatically.
   */
  function useRoomMessage(
    type: string | number | "*",
    callback: (...args: any[]) => void
  ): void {
    const { room } = useSyncExternalStore(subscribe, getSnapshot);
    useRoomMessageStandalone(room, type, callback);
  }

  return { RoomProvider, useRoom, useRoomState, useRoomMessage };
}
