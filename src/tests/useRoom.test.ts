import 'reflect-metadata';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { useRoom } from '../room/useRoom';
import { Room } from '@colyseus/sdk';

function createMockRoom<T = any>(state?: T): Room<T> {
    return {
        leave: vi.fn().mockResolvedValue(1),
        state: state ?? ({} as T),
        roomId: 'mock-room-' + Math.random().toString(36).slice(2),
        sessionId: 'mock-session',
        connection: { isOpen: true },
        removeAllListeners: vi.fn(),
    } as unknown as Room<T>;
}

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('useRoom', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('basic connection', () => {
        test('connects and returns room', async () => {
            const room = createMockRoom();
            const connect = vi.fn().mockResolvedValue(room);

            const { result } = renderHook(() => useRoom(connect));

            expect(result.current.isConnecting).toBe(true);
            expect(result.current.room).toBeUndefined();

            await act(async () => {});

            expect(result.current.isConnecting).toBe(false);
            expect(result.current.room).toBe(room);
            expect(result.current.error).toBeUndefined();
            expect(connect).toHaveBeenCalledTimes(1);
        });

        test('reports error on connection failure', async () => {
            const connect = vi.fn().mockRejectedValue(new Error('Connection failed'));

            const { result } = renderHook(() => useRoom(connect));

            expect(result.current.isConnecting).toBe(true);

            await act(async () => {});

            expect(result.current.isConnecting).toBe(false);
            expect(result.current.room).toBeUndefined();
            expect(result.current.error).toBeInstanceOf(Error);
            expect(result.current.error!.message).toBe('Connection failed');
        });

        test('wraps non-Error rejection in Error', async () => {
            const connect = vi.fn().mockRejectedValue('string error');

            const { result } = renderHook(() => useRoom(connect));
            await act(async () => {});

            expect(result.current.error).toBeInstanceOf(Error);
            expect(result.current.error!.message).toBe('string error');
        });
    });

    describe('falsy callback', () => {
        test('does not connect when callback is null', () => {
            const { result } = renderHook(() => useRoom(null));

            expect(result.current.isConnecting).toBe(false);
            expect(result.current.room).toBeUndefined();
            expect(result.current.error).toBeUndefined();
        });

        test('does not connect when callback is undefined', () => {
            const { result } = renderHook(() => useRoom(undefined));

            expect(result.current.isConnecting).toBe(false);
            expect(result.current.room).toBeUndefined();
        });

        test('does not connect when callback is false', () => {
            const { result } = renderHook(() => useRoom(false));

            expect(result.current.isConnecting).toBe(false);
            expect(result.current.room).toBeUndefined();
        });
    });

    describe('cleanup on unmount', () => {
        test('leaves room on unmount after connection', async () => {
            const room = createMockRoom();
            const connect = vi.fn().mockResolvedValue(room);

            const { result, unmount } = renderHook(() => useRoom(connect));

            await act(async () => {});
            expect(result.current.room).toBe(room);

            unmount();

            // Flush the deferred cleanup timeout
            act(() => { vi.advanceTimersByTime(1); });

            expect(room.leave).toHaveBeenCalledTimes(1);
        });

        test('leaves room when promise resolves after unmount', async () => {
            const room = createMockRoom();
            const d = deferred<Room>();
            const connect = vi.fn().mockReturnValue(d.promise);

            const { unmount } = renderHook(() => useRoom(connect));

            unmount();

            // Flush deferred cleanup
            act(() => { vi.advanceTimersByTime(1); });

            // Now resolve the promise after unmount
            await act(async () => { d.resolve(room as Room); });

            expect(room.leave).toHaveBeenCalledTimes(1);
        });
    });

    describe('deps changes', () => {
        test('reconnects when deps change', async () => {
            const room1 = createMockRoom();
            const room2 = createMockRoom();
            let roomName = 'room1';

            const { result, rerender } = renderHook(() =>
                useRoom(() => Promise.resolve(roomName === 'room1' ? room1 : room2) as Promise<Room>, [roomName])
            );

            await act(async () => {});
            expect(result.current.room).toBe(room1);

            // Change deps
            roomName = 'room2';
            rerender();

            await act(async () => {});
            expect(result.current.room).toBe(room2);
            expect(room1.leave).toHaveBeenCalledTimes(1);
        });

        test('leaves pending room when deps change before resolution', async () => {
            const room1 = createMockRoom();
            const room2 = createMockRoom();
            const d1 = deferred<Room>();
            let roomName = 'room1';

            const { result, rerender } = renderHook(() =>
                useRoom(() => roomName === 'room1' ? d1.promise as Promise<Room> : Promise.resolve(room2) as Promise<Room>, [roomName])
            );

            expect(result.current.isConnecting).toBe(true);

            // Change deps before first connection resolves
            roomName = 'room2';
            rerender();

            await act(async () => {});
            expect(result.current.room).toBe(room2);

            // Now resolve the old promise - old room should be left
            await act(async () => { d1.resolve(room1 as Room); });
            expect(room1.leave).toHaveBeenCalledTimes(1);
        });
    });

    describe('conditional connection', () => {
        test('connects when callback changes from falsy to truthy', async () => {
            const room = createMockRoom();
            let isReady = false;

            const { result, rerender } = renderHook(() =>
                useRoom(isReady ? () => Promise.resolve(room) as Promise<Room> : null, [isReady])
            );

            expect(result.current.isConnecting).toBe(false);
            expect(result.current.room).toBeUndefined();

            isReady = true;
            rerender();

            await act(async () => {});
            expect(result.current.room).toBe(room);
        });

        test('leaves room when callback changes from truthy to falsy', async () => {
            const room = createMockRoom();
            let isReady = true;

            const { result, rerender } = renderHook(() =>
                useRoom(isReady ? () => Promise.resolve(room) as Promise<Room> : null, [isReady])
            );

            await act(async () => {});
            expect(result.current.room).toBe(room);

            isReady = false;
            rerender();

            expect(result.current.room).toBeUndefined();
            expect(room.leave).toHaveBeenCalledTimes(1);
        });
    });

    describe('StrictMode', () => {
        test('only calls connect once during StrictMode double mount', async () => {
            const room = createMockRoom();
            const connect = vi.fn().mockResolvedValue(room);

            const { result } = renderHook(() => useRoom(connect), {
                wrapper: ({ children }: { children: React.ReactNode }) =>
                    React.createElement(React.StrictMode, null, children),
            });

            await act(async () => {});

            // The connect callback should only have been called once,
            // even though StrictMode caused a mount-unmount-remount cycle.
            expect(connect).toHaveBeenCalledTimes(1);
            expect(result.current.room).toBe(room);
            expect(room.leave).not.toHaveBeenCalled();
        });
    });
});
