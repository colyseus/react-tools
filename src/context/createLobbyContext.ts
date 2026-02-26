import { useSyncExternalStore, useEffect, type ReactNode, type DependencyList } from "react";
import { Room } from "@colyseus/sdk";
import { useLobbyRoom as useLobbyRoomOriginal, type UseLobbyRoomResult } from "../room/useLobbyRoom";

interface LobbyProviderProps {
  connect: (() => Promise<Room>) | null | undefined | false;
  deps?: DependencyList;
  children: ReactNode;
}

/**
 * Creates a LobbyProvider and useLobby hook for sharing lobby room data
 * (available rooms + metadata) globally across your app.
 *
 * Uses a closure-scoped external store (not React Context), so the hook
 * works in any reconciler tree that imports it.
 *
 * This is useful when you need lobby metadata available persistently
 * alongside an active game room — not just on a lobby screen.
 *
 * @template Metadata - The type of room metadata
 *
 * @example
 * ```tsx
 * const { LobbyProvider, useLobby } = createLobbyContext<MyMetadata>();
 *
 * // Wrap your app (can nest with RoomProvider)
 * <LobbyProvider connect={() => client.joinLobby()}>
 *   <RoomProvider connect={() => client.joinOrCreate("game")}>
 *     <App />
 *   </RoomProvider>
 * </LobbyProvider>
 *
 * // In any component:
 * const { rooms } = useLobby();
 * rooms.map(r => r.metadata.displayName)
 * ```
 */
export function createLobbyContext<Metadata = any>() {
  let snapshot: UseLobbyRoomResult<Metadata> = {
    rooms: [],
    room: undefined,
    error: undefined,
    isConnecting: true,
  };
  const listeners = new Set<() => void>();

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getSnapshot(): UseLobbyRoomResult<Metadata> {
    return snapshot;
  }

  function setSnapshot(next: UseLobbyRoomResult<Metadata>) {
    snapshot = next;
    for (const listener of listeners) listener();
  }

  /**
   * Manages the lobby room lifecycle. Render once near the root of your app.
   * Lobby state is shared via the closure-scoped external store, not React Context.
   */
  function LobbyProvider({ connect, deps = [], children }: LobbyProviderProps) {
    const { rooms, room, error, isConnecting } = useLobbyRoomOriginal<Metadata>(connect, deps);

    useEffect(() => {
      setSnapshot({ rooms, room, error, isConnecting });
    }, [rooms, room, error, isConnecting]);

    return children;
  }

  /**
   * Returns the list of available rooms, the lobby room instance,
   * error, and connection status.
   * Works in DOM tree, R3F tree, or any other reconciler tree.
   */
  function useLobby(): UseLobbyRoomResult<Metadata> {
    return useSyncExternalStore(subscribe, getSnapshot);
  }

  return { LobbyProvider, useLobby };
}
