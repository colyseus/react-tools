import React from 'react';
import { render, screen, act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Room, type RoomAvailable } from '@colyseus/sdk';
import { createLobbyContext } from '../context/createLobbyContext';

type Handler = (...args: any[]) => void;

function fakeLobby() {
    const handlers = new Map<string | number | "*", Set<Handler>>();
    const emit = (type: string | number, ...args: any[]) => {
        handlers.get(type)?.forEach((h) => h(...args));
    };
    const room = {
        roomId: "lobby",
        sessionId: "s",
        state: {},
        connection: { isOpen: true },
        leave: vi.fn().mockResolvedValue(1),
        removeAllListeners: vi.fn(),
        onMessage: vi.fn((type: string | number | "*", handler: Handler) => {
            let set = handlers.get(type);
            if (!set) { set = new Set(); handlers.set(type, set); }
            set.add(handler);
            return () => set!.delete(handler);
        }),
    } as unknown as Room;
    return { room, emit };
}

describe('createLobbyContext', () => {
    test('useLobby sees rooms added through the provider', async () => {
        const { room, emit } = fakeLobby();
        const { LobbyProvider, useLobby } = createLobbyContext();

        function Probe() {
            const { rooms, isConnecting } = useLobby();
            return <div data-testid="p">{isConnecting ? "c" : `n=${rooms.length}`}</div>;
        }

        await act(async () => {
            render(
                <LobbyProvider connect={() => Promise.resolve(room)}>
                    <Probe />
                </LobbyProvider>
            );
        });

        await act(async () => {
            emit("rooms", [
                { roomId: "r1" } as RoomAvailable,
                { roomId: "r2" } as RoomAvailable,
            ]);
        });

        expect(screen.getByTestId("p").textContent).toBe("n=2");
    });

    test('multiple consumer trees see the same lobby snapshot', async () => {
        const { room, emit } = fakeLobby();
        const { LobbyProvider, useLobby } = createLobbyContext();

        await act(async () => {
            render(
                <LobbyProvider connect={() => Promise.resolve(room)}>
                    <div />
                </LobbyProvider>
            );
        });

        const a = renderHook(() => useLobby());
        const b = renderHook(() => useLobby());

        await act(async () => {
            emit("rooms", [{ roomId: "r1" } as RoomAvailable]);
        });

        expect(a.result.current.rooms.length).toBe(1);
        expect(b.result.current.rooms.length).toBe(1);
        expect(a.result.current.rooms).toBe(b.result.current.rooms);
    });
});
