import 'reflect-metadata';
import React from 'react';
import { render, screen, act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Room } from '@colyseus/sdk';
import { createRoomContext } from '../context/createRoomContext';
import { simulateState } from './schema/simulateState';
import { MyRoomState, Player } from './schema/MyRoomState';

type Handler = (...args: any[]) => void;

function fakeRoom(state: MyRoomState, decoder: any) {
    const handlers = new Map<string | number | "*", Set<Handler>>();
    const emit = (type: string | number, ...args: any[]) => {
        handlers.get(type)?.forEach((h) => h(...args));
        handlers.get("*")?.forEach((h) => h(type, ...args));
    };
    const onMessage = vi.fn((type: string | number | "*", handler: Handler) => {
        let set = handlers.get(type);
        if (!set) { set = new Set(); handlers.set(type, set); }
        set.add(handler);
        return () => set!.delete(handler);
    });
    const room = {
        roomId: "r1",
        sessionId: "s1",
        state,
        serializer: { decoder },
        connection: { isOpen: true },
        onMessage,
        leave: vi.fn().mockResolvedValue(1),
        removeAllListeners: vi.fn(),
    } as unknown as Room<any, MyRoomState>;
    return { room, emit };
}

describe('createRoomContext', () => {
    test('useRoom / useRoomState / useRoomMessage bridge a single room', async () => {
        const sim = simulateState(() => new MyRoomState());
        sim.updateState((s) => { s.players.set("p1", new Player().assign({ name: "P1" })); });
        const { room, emit } = fakeRoom(sim.clientState, sim.decoder);

        const { RoomProvider, useRoom, useRoomState, useRoomMessage } =
            createRoomContext<any, MyRoomState>();

        const messageLog: string[] = [];

        function Child() {
            const { room: r, isConnecting } = useRoom();
            const myString = useRoomState((s) => s.myString);
            useRoomMessage("chat", (p: string) => { messageLog.push(p); });
            return <div data-testid="out">{isConnecting ? "connecting" : `room=${r?.roomId} str=${myString}`}</div>;
        }

        await act(async () => {
            render(
                <RoomProvider connect={() => Promise.resolve(room)}>
                    <Child />
                </RoomProvider>
            );
        });

        expect(screen.getByTestId("out").textContent).toBe("room=r1 str=Hello world!");

        // State updates flow to consumers.
        await act(async () => {
            sim.updateState((s) => { s.myString = "new"; });
        });
        expect(screen.getByTestId("out").textContent).toBe("room=r1 str=new");

        // Messages flow to consumers.
        await act(async () => { emit("chat", "yo"); });
        expect(messageLog).toEqual(["yo"]);
    });

    test('useRoomState returns undefined before connection resolves', () => {
        const { RoomProvider, useRoomState } = createRoomContext();
        let pending!: (r: Room) => void;
        const connect = () => new Promise<Room>((resolve) => { pending = resolve; });

        function Probe() {
            const state = useRoomState();
            return <div data-testid="p">{state === undefined ? "no-state" : "has-state"}</div>;
        }

        render(
            <RoomProvider connect={connect}>
                <Probe />
            </RoomProvider>
        );

        expect(screen.getByTestId("p").textContent).toBe("no-state");
        // Silence unused var warning; the point is no-state before resolve.
        void pending;
    });

    test('store works across independent renderHook trees', async () => {
        const sim = simulateState(() => new MyRoomState());
        const { room } = fakeRoom(sim.clientState, sim.decoder);

        const { RoomProvider, useRoomState } = createRoomContext<any, MyRoomState>();

        // Provider tree
        await act(async () => {
            render(
                <RoomProvider connect={() => Promise.resolve(room)}>
                    <div />
                </RoomProvider>
            );
        });

        // Consumer in a completely separate render tree — same closure-scoped store.
        const { result } = renderHook(() => useRoomState((s) => s.myString));
        expect(result.current).toBe("Hello world!");

        await act(async () => { sim.updateState((s) => { s.myString = "x"; }); });
        expect(result.current).toBe("x");
    });
});
