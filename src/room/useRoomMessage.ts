import type { ExtractRoomClientMessages, NormalizeRoomType } from "@colyseus/shared-types";
import { Room } from "@colyseus/sdk";
import { useEffect, useRef } from "react";

export function useRoomMessage<T, MessageType extends keyof ExtractRoomClientMessages<NormalizeRoomType<T>>>(
  room: Room<T> | null | undefined,
  type: MessageType,
  callback: (payload: ExtractRoomClientMessages<NormalizeRoomType<T>>[MessageType]) => void
): void;

export function useRoomMessage<T>(
  room: Room<T> | null | undefined,
  type: "*",
  callback: (messageType: string | number, payload: any) => void
): void;

export function useRoomMessage<T, Payload = any>(
  room: Room<T> | null | undefined,
  type: [keyof ExtractRoomClientMessages<NormalizeRoomType<T>>] extends [never] ? (string | number) : never,
  callback: (payload: Payload) => void
): void;

export function useRoomMessage(
  room: Room | null | undefined,
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
