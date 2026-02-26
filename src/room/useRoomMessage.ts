import { Room } from "@colyseus/sdk";
import { useEffect, useRef } from "react";

export function useRoomMessage(
  room: Room<any, any> | null | undefined,
  type: string | number | "*",
  callback: (...args: any[]) => void
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!room) return;

    const handler = (...args: any[]) => callbackRef.current(...args);
    const unsubscribe = room.onMessage(type as any, handler as any);

    return unsubscribe;
  }, [room, type]);
}
