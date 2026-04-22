import 'reflect-metadata';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useColyseusState } from '../schema/useColyseusState';
import { simulateState } from './schema/simulateState';
import { MyRoomState, Player, Position } from './schema/MyRoomState';
import { PrimitiveCollectionsState } from './schema/PrimitiveCollectionsState';

describe('Schema reference reassignment', () => {
    test('replacing a child Schema swaps its snapshot and reallocates the parent', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());
        updateState((s) => { s.players.set("p1", new Player().assign({ name: "P1" })); });
        updateState((s) => { s.players.get("p1")!.position.x = 1; });

        const { result } = renderHook(() => useColyseusState(clientState, decoder));

        const prevPlayers = result.current.players;
        const prevPlayer = prevPlayers.p1;
        const prevPosition = prevPlayer.position;

        act(() => {
            updateState((s) => {
                const p = s.players.get("p1")!;
                p.position = new Position().assign({ x: 99, y: 99 });
            });
        });

        const nextPlayer = result.current.players.p1;

        expect(result.current.players).not.toBe(prevPlayers);
        expect(nextPlayer).not.toBe(prevPlayer);
        expect(nextPlayer.position).not.toBe(prevPosition);
        expect(nextPlayer.position).toEqual(expect.objectContaining({ x: 99, y: 99 }));
    });
});

describe('MapSchema clear', () => {
    test('clearing a map reallocates the map and leaves it empty', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());
        updateState((s) => {
            s.players.set("p1", new Player().assign({ name: "P1" }));
            s.players.set("p2", new Player().assign({ name: "P2" }));
        });

        const { result } = renderHook(() => useColyseusState(clientState, decoder));
        const before = result.current.players;
        expect(Object.keys(before)).toEqual(["p1", "p2"]);

        act(() => { updateState((s) => { s.players.clear(); }); });

        expect(result.current.players).not.toBe(before);
        expect(result.current.players).toEqual({});
    });

    test('re-populating after clear produces fresh entries', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());
        updateState((s) => { s.players.set("p1", new Player().assign({ name: "P1" })); });

        const { result } = renderHook(() => useColyseusState(clientState, decoder));

        act(() => { updateState((s) => { s.players.clear(); }); });
        act(() => { updateState((s) => { s.players.set("p1", new Player().assign({ name: "reborn" })); }); });

        expect(result.current.players.p1.name).toBe("reborn");
    });
});

describe('MapSchema<primitive> clear and rebuild', () => {
    test('clear + repopulate on a primitive map', () => {
        const { clientState, decoder, updateState } = simulateState(() => new PrimitiveCollectionsState());
        updateState((s) => { s.scores.set("a", 1).set("b", 2); });

        const { result } = renderHook(() => useColyseusState(clientState, decoder));

        act(() => { updateState((s) => { s.scores.clear(); }); });
        expect(result.current.scores).toEqual({});

        act(() => { updateState((s) => { s.scores.set("c", 3); }); });
        expect(result.current.scores).toEqual({ c: 3 });
    });
});
