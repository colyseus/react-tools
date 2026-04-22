import { renderHook, act } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Room } from '@colyseus/sdk';
import { useRoomMessage } from '../room/useRoomMessage';

type Handler = (...args: any[]) => void;

function createMockRoom(): {
    room: Room;
    emit: (type: string | number, ...args: any[]) => void;
    handlersFor: (type: string | number | "*") => Handler[];
} {
    const handlers = new Map<string | number | "*", Set<Handler>>();

    const onMessage = vi.fn((type: string | number | "*", handler: Handler) => {
        let set = handlers.get(type);
        if (!set) { set = new Set(); handlers.set(type, set); }
        set.add(handler);
        return () => set!.delete(handler);
    });

    const emit = (type: string | number, ...args: any[]) => {
        handlers.get(type)?.forEach((h) => h(...args));
        handlers.get("*")?.forEach((h) => h(type, ...args));
    };

    const room = { onMessage } as unknown as Room;
    const handlersFor = (type: string | number | "*") => Array.from(handlers.get(type) ?? []);
    return { room, emit, handlersFor };
}

describe('useRoomMessage', () => {
    test('invokes callback when matching message arrives', () => {
        const { room, emit } = createMockRoom();
        const cb = vi.fn();

        renderHook(() => useRoomMessage(room, "chat", cb));

        act(() => emit("chat", { text: "hi" }));
        expect(cb).toHaveBeenCalledWith({ text: "hi" });
    });

    test('does nothing when room is null or undefined', () => {
        const cb = vi.fn();
        renderHook(() => useRoomMessage(null as any, "chat", cb));
        renderHook(() => useRoomMessage(undefined as any, "chat", cb));
        // No crash; callback never invoked (nothing to emit from).
        expect(cb).not.toHaveBeenCalled();
    });

    test('unsubscribes on unmount', () => {
        const { room, emit, handlersFor } = createMockRoom();
        const cb = vi.fn();

        const { unmount } = renderHook(() => useRoomMessage(room, "chat", cb));

        expect(handlersFor("chat")).toHaveLength(1);
        unmount();
        expect(handlersFor("chat")).toHaveLength(0);

        act(() => emit("chat", { text: "after unmount" }));
        expect(cb).not.toHaveBeenCalled();
    });

    test('re-subscribes when message type changes', () => {
        const { room, emit } = createMockRoom();
        const cb = vi.fn();

        let type: "a" | "b" = "a";
        const { rerender } = renderHook(() => useRoomMessage(room, type, cb));

        act(() => emit("a", 1));
        expect(cb).toHaveBeenCalledWith(1);
        cb.mockClear();

        type = "b";
        rerender();

        act(() => emit("a", 2));
        expect(cb).not.toHaveBeenCalled();

        act(() => emit("b", 3));
        expect(cb).toHaveBeenCalledWith(3);
    });

    test('re-subscribes when room changes', () => {
        const a = createMockRoom();
        const b = createMockRoom();
        const cb = vi.fn();

        let room: Room = a.room;
        const { rerender } = renderHook(() => useRoomMessage(room, "chat", cb));

        act(() => a.emit("chat", "from-a"));
        expect(cb).toHaveBeenCalledWith("from-a");
        cb.mockClear();

        room = b.room;
        rerender();

        act(() => a.emit("chat", "from-a-after-switch"));
        expect(cb).not.toHaveBeenCalled();

        act(() => b.emit("chat", "from-b"));
        expect(cb).toHaveBeenCalledWith("from-b");
    });

    test('latest callback is used without re-subscribing', () => {
        const { room, emit, handlersFor } = createMockRoom();

        let cb = vi.fn();
        const { rerender } = renderHook(() => useRoomMessage(room, "chat", cb));

        const subscribedHandler = handlersFor("chat")[0];

        const newCb = vi.fn();
        cb = newCb;
        rerender();

        // Same registered handler — no re-subscription.
        expect(handlersFor("chat")[0]).toBe(subscribedHandler);

        act(() => emit("chat", "msg"));
        expect(newCb).toHaveBeenCalledWith("msg");
    });

    test('wildcard "*" receives all message types', () => {
        const { room, emit } = createMockRoom();
        const cb = vi.fn();

        renderHook(() => useRoomMessage(room, "*", cb));

        act(() => emit("foo", 1));
        act(() => emit("bar", 2));

        expect(cb).toHaveBeenNthCalledWith(1, "foo", 1);
        expect(cb).toHaveBeenNthCalledWith(2, "bar", 2);
    });
});
