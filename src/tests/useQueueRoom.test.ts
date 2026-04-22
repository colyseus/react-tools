import { renderHook, act } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { Room, type SeatReservation } from '@colyseus/sdk';
import { useQueueRoom } from '../room/useQueueRoom';

type Handler = (...args: any[]) => void;

function makeRoom(id: string) {
    const handlers = new Map<string | number | "*", Set<Handler>>();
    const emit = (type: string | number, ...args: any[]) => {
        handlers.get(type)?.forEach((h) => h(...args));
    };
    const sent: Array<{ type: any; payload?: any }> = [];
    const room = {
        roomId: id,
        sessionId: id + "-sess",
        state: {},
        connection: { isOpen: true },
        leave: vi.fn().mockResolvedValue(1),
        removeAllListeners: vi.fn(),
        send: vi.fn((type: any, payload?: any) => { sent.push({ type, payload }); }),
        onMessage: vi.fn((type: string | number | "*", handler: Handler) => {
            let set = handlers.get(type);
            if (!set) { set = new Set(); handlers.set(type, set); }
            set.add(handler);
            return () => set!.delete(handler);
        }),
    } as unknown as Room;
    return { room, emit, sent };
}

describe('useQueueRoom', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    test('isWaiting flips true after queue connects', async () => {
        const queue = makeRoom("queue");
        const consume = vi.fn();

        const { result } = renderHook(() =>
            useQueueRoom(() => Promise.resolve(queue.room), consume)
        );

        expect(result.current.isWaiting).toBe(false);
        await act(async () => { });
        expect(result.current.isWaiting).toBe(true);
        expect(result.current.queue).toBe(queue.room);
        expect(result.current.room).toBeUndefined();
    });

    test('"clients" message updates group size', async () => {
        const queue = makeRoom("queue");
        const { result } = renderHook(() =>
            useQueueRoom(() => Promise.resolve(queue.room), vi.fn())
        );
        await act(async () => { });

        await act(async () => { queue.emit("clients", 3); });
        expect(result.current.clients).toBe(3);

        await act(async () => { queue.emit("clients", 4); });
        expect(result.current.clients).toBe(4);
    });

    test('"seat" triggers confirm, consume, and match room promotion', async () => {
        const queue = makeRoom("queue");
        const match = makeRoom("match");
        const consume = vi.fn().mockResolvedValue(match.room);
        const reservation = { sessionId: "seat1", room: { roomId: "match" } } as unknown as SeatReservation;

        const { result } = renderHook(() =>
            useQueueRoom(() => Promise.resolve(queue.room), consume)
        );
        await act(async () => { });

        await act(async () => { queue.emit("seat", reservation); });
        // Microtask flush so the consume() promise resolves.
        await act(async () => { });

        expect(queue.sent).toContainEqual({ type: "confirm", payload: undefined });
        expect(consume).toHaveBeenCalledWith(reservation);
        expect(result.current.room).toBe(match.room);
        expect(result.current.queue).toBeUndefined();
        expect(result.current.isWaiting).toBe(false);
        expect(queue.room.leave).toHaveBeenCalled();
    });

    test('"seat" twice only consumes once (idempotent)', async () => {
        const queue = makeRoom("queue");
        const match = makeRoom("match");
        const consume = vi.fn().mockResolvedValue(match.room);
        const reservation = { sessionId: "seat1" } as unknown as SeatReservation;

        renderHook(() => useQueueRoom(() => Promise.resolve(queue.room), consume));
        await act(async () => { });

        await act(async () => { queue.emit("seat", reservation); });
        await act(async () => { queue.emit("seat", reservation); });
        await act(async () => { });

        expect(consume).toHaveBeenCalledTimes(1);
    });

    test('consume rejection surfaces as error', async () => {
        const queue = makeRoom("queue");
        const consume = vi.fn().mockRejectedValue(new Error("consume failed"));
        const reservation = {} as SeatReservation;

        const { result } = renderHook(() =>
            useQueueRoom(() => Promise.resolve(queue.room), consume)
        );
        await act(async () => { });

        await act(async () => { queue.emit("seat", reservation); });
        await act(async () => { });

        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error!.message).toBe("consume failed");
        expect(result.current.room).toBeUndefined();
    });

    test('queue connection error surfaces as error', async () => {
        const consume = vi.fn();
        const { result } = renderHook(() =>
            useQueueRoom(() => Promise.reject(new Error("cannot join queue")), consume)
        );
        await act(async () => { });

        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error!.message).toBe("cannot join queue");
        expect(result.current.isWaiting).toBe(false);
    });

    test('unmount after promotion leaves the match room', async () => {
        const queue = makeRoom("queue");
        const match = makeRoom("match");
        const consume = vi.fn().mockResolvedValue(match.room);

        const { result, unmount } = renderHook(() =>
            useQueueRoom(() => Promise.resolve(queue.room), consume)
        );
        await act(async () => { });
        await act(async () => { queue.emit("seat", {} as SeatReservation); });
        await act(async () => { });
        expect(result.current.room).toBe(match.room);

        unmount();
        // Match room cleanup runs on unmount, queue cleanup via useRoom setTimeout(0).
        await act(async () => { vi.runAllTimers(); });

        expect(match.room.leave).toHaveBeenCalled();
    });
});
