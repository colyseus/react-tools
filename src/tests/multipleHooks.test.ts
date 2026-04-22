import 'reflect-metadata';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useColyseusState } from '../schema/useColyseusState';
import { getOrCreateSubscription } from '../schema/getOrCreateSubscription';
import { simulateState } from './schema/simulateState';
import { MyRoomState, Player } from './schema/MyRoomState';

describe('multiple hooks on the same state', () => {
    test('all mounted hooks see updates', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());

        const hookA = renderHook(() => useColyseusState(clientState, decoder));
        const hookB = renderHook(() => useColyseusState(clientState, decoder, (s) => s.players));
        const hookC = renderHook(() => useColyseusState(clientState, decoder, (s) => s.myString));

        act(() => {
            updateState((s) => {
                s.myString = "hi";
                s.players.set("p1", new Player().assign({ name: "P1" }));
            });
        });

        expect(hookA.result.current.myString).toBe("hi");
        expect(hookA.result.current.players.p1.name).toBe("P1");
        expect((hookB.result.current as any).p1.name).toBe("P1");
        expect(hookC.result.current).toBe("hi");
    });

    test('all hooks share a single subscription (one decode wrap)', () => {
        const { clientState, decoder } = simulateState(() => new MyRoomState());

        // First hook installs the decode wrapper.
        renderHook(() => useColyseusState(clientState, decoder));
        const sub = getOrCreateSubscription(clientState, decoder);

        const listenersAfterFirst = sub.listeners.size;

        // A second hook should add exactly one more listener, not re-wrap decode.
        renderHook(() => useColyseusState(clientState, decoder));
        expect(sub.listeners.size).toBe(listenersAfterFirst + 1);

        // And a third.
        renderHook(() => useColyseusState(clientState, decoder));
        expect(sub.listeners.size).toBe(listenersAfterFirst + 2);
    });

    test('unmounting one hook removes only its listener', () => {
        const { clientState, decoder } = simulateState(() => new MyRoomState());
        const a = renderHook(() => useColyseusState(clientState, decoder));
        const b = renderHook(() => useColyseusState(clientState, decoder));
        const sub = getOrCreateSubscription(clientState, decoder);

        const listenersBoth = sub.listeners.size;
        a.unmount();
        expect(sub.listeners.size).toBe(listenersBoth - 1);

        b.unmount();
        expect(sub.listeners.size).toBe(listenersBoth - 2);
    });

    test('two hooks observing the same slice return equal references', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());
        updateState((s) => { s.players.set("p1", new Player().assign({ name: "P1" })); });

        const a = renderHook(() => useColyseusState(clientState, decoder, (s) => s.players));
        const b = renderHook(() => useColyseusState(clientState, decoder, (s) => s.players));

        // Both selectors pull the same cached snapshot node.
        expect(a.result.current).toBe(b.result.current);

        act(() => { updateState((s) => { s.myString = "change"; }); });

        // Still shared after an unrelated update.
        expect(a.result.current).toBe(b.result.current);
    });
});
