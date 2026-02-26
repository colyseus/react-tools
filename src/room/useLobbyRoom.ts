import { Room, type RoomAvailable } from "@colyseus/sdk";
import { useState, useEffect, type DependencyList } from "react";
import { useRoom } from "./useRoom";

export interface UseLobbyRoomResult<Metadata = any> {
  rooms: RoomAvailable<Metadata>[];
  room: Room | undefined;
  error: Error | undefined;
  isConnecting: boolean;
}

export function useLobbyRoom<Metadata = any>(
  callback: (() => Promise<Room>) | null | undefined | false,
  deps: DependencyList = []
): UseLobbyRoomResult<Metadata> {
  const { room, error, isConnecting } = useRoom(callback, deps);
  const [rooms, setRooms] = useState<RoomAvailable<Metadata>[]>([]);

  useEffect(() => {
    if (!room) {
      setRooms([]);
      return;
    }

    const unsubs: (() => void)[] = [];

    unsubs.push(room.onMessage("rooms", (roomList: RoomAvailable<Metadata>[]) => {
      setRooms(roomList);
    }));

    unsubs.push(room.onMessage("+", ([roomId, roomData]: [string, RoomAvailable<Metadata>]) => {
      setRooms(prev => {
        const index = prev.findIndex(r => r.roomId === roomId);
        if (index !== -1) {
          const next = [...prev];
          next[index] = roomData;
          return next;
        }
        return [...prev, roomData];
      });
    }));

    unsubs.push(room.onMessage("-", (roomId: string) => {
      setRooms(prev => prev.filter(r => r.roomId !== roomId));
    }));

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [room]);

  return { rooms, room, error, isConnecting };
}
