import 'reflect-metadata';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useColyseusState } from '../schema/useColyseusState';
import { simulateState } from './schema/simulateState';
import { MyRoomState, Player } from './schema/MyRoomState';

describe('state/decoder becoming available later', () => {
    test('undefined → defined transitions to real snapshot', () => {
        const sim = simulateState(() => new MyRoomState());
        sim.updateState((s) => { s.players.set("p1", new Player().assign({ name: "P1" })); });

        let state: MyRoomState | undefined = undefined;
        let decoder: typeof sim.decoder | undefined = undefined;

        const { result, rerender } = renderHook(() => useColyseusState(state, decoder));

        expect(result.current).toBeUndefined();

        state = sim.clientState;
        decoder = sim.decoder;
        rerender();

        expect(result.current).toBeDefined();
        expect((result.current as any).players.p1.name).toBe("P1");
    });

    test('updates after late-binding keep arriving', () => {
        const sim = simulateState(() => new MyRoomState());

        let state: MyRoomState | undefined = undefined;
        let decoder: typeof sim.decoder | undefined = undefined;

        const { result, rerender } = renderHook(() => useColyseusState(state, decoder));
        expect(result.current).toBeUndefined();

        state = sim.clientState;
        decoder = sim.decoder;
        rerender();

        act(() => { sim.updateState((s) => { s.myString = "after-bind"; }); });

        expect((result.current as any).myString).toBe("after-bind");
    });
});
