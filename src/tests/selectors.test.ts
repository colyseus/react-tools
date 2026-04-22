import 'reflect-metadata';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { useColyseusState } from '../schema/useColyseusState';
import { simulateState } from './schema/simulateState';
import { MyRoomState, Player } from './schema/MyRoomState';

describe('useColyseusState selectors', () => {
    test('selecting a primitive returns the primitive', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());

        const { result } = renderHook(() =>
            useColyseusState(clientState, decoder, (s) => s.myString)
        );

        expect(result.current).toBe("Hello world!");

        act(() => { updateState((s) => { s.myString = "updated"; }); });

        expect(result.current).toBe("updated");
    });

    test('selecting a sub-tree returns only that snapshot slice', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());
        updateState((s) => { s.players.set("p1", new Player().assign({ name: "P1" })); });

        const { result } = renderHook(() =>
            useColyseusState(clientState, decoder, (s) => s.players)
        );

        expect(result.current).toEqual({ p1: expect.objectContaining({ name: "P1" }) });
        expect("myString" in (result.current as object)).toBe(false);
    });

    test('selector-returned slice is referentially stable across unrelated changes', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());
        updateState((s) => { s.players.set("p1", new Player().assign({ name: "P1" })); });

        const { result } = renderHook(() =>
            useColyseusState(clientState, decoder, (s) => s.players)
        );
        const before = result.current;

        act(() => { updateState((s) => { s.myString = "changed"; }); });

        expect(result.current).toBe(before);
    });

    test('selector-returned slice updates when its slice changes', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());
        updateState((s) => { s.players.set("p1", new Player().assign({ name: "P1" })); });

        const { result } = renderHook(() =>
            useColyseusState(clientState, decoder, (s) => s.players)
        );
        const before = result.current;

        act(() => { updateState((s) => { s.players.get("p1")!.name = "renamed"; }); });

        expect(result.current).not.toBe(before);
        expect((result.current as any).p1.name).toBe("renamed");
    });

    test('selector returning undefined does not crash', () => {
        const { clientState, decoder } = simulateState(() => new MyRoomState());

        const { result } = renderHook(() =>
            useColyseusState(clientState, decoder, () => undefined)
        );

        expect(result.current).toBeUndefined();
    });

    test('changing the selector function uses the latest one on next render', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());
        updateState((s) => { s.players.set("p1", new Player().assign({ name: "P1" })); });

        let key: "myString" | "players" = "myString";
        const { result, rerender } = renderHook(() =>
            useColyseusState(clientState, decoder, (s) => s[key])
        );

        expect(result.current).toBe("Hello world!");

        key = "players";
        rerender();

        expect(result.current).toEqual({ p1: expect.objectContaining({ name: "P1" }) });
    });

    test('selector is invoked on each render even without state changes', () => {
        const { clientState, decoder } = simulateState(() => new MyRoomState());
        const selector = vi.fn((s: MyRoomState) => s.myString);

        const { rerender } = renderHook(() => useColyseusState(clientState, decoder, selector));

        const callsAfterFirstRender = selector.mock.calls.length;
        expect(callsAfterFirstRender).toBeGreaterThan(0);

        rerender();

        expect(selector.mock.calls.length).toBeGreaterThan(callsAfterFirstRender);
    });

    test('selector returning a deeply-nested Schema node snapshots that node', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());
        updateState((s) => { s.players.set("p1", new Player().assign({ name: "P1" })); });
        updateState((s) => { s.players.get("p1")!.position.x = 5; });

        const { result } = renderHook(() =>
            useColyseusState(clientState, decoder, (s) => s.players.get("p1")?.position)
        );

        expect(result.current).toEqual(expect.objectContaining({ x: 5, y: 0 }));

        const before = result.current;
        act(() => { updateState((s) => { s.myString = "changed"; }); });

        // Unrelated change should keep the selected slice stable.
        expect(result.current).toBe(before);
    });
});
