import 'reflect-metadata';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useColyseusState } from '../schema/useColyseusState';
import { simulateState } from './schema/simulateState';
import { PrimitiveCollectionsState } from './schema/PrimitiveCollectionsState';

describe('primitive ArraySchema<number>', () => {
    test('round-trips values and produces plain number[]', () => {
        const { clientState, decoder, updateState } = simulateState(() => new PrimitiveCollectionsState());
        updateState((s) => { s.numbers.push(1, 2, 3); });

        const { result } = renderHook(() => useColyseusState(clientState, decoder));

        expect(Array.isArray(result.current.numbers)).toBe(true);
        expect(Array.from(result.current.numbers)).toEqual([1, 2, 3]);
    });

    test('pushing a value creates a new array reference', () => {
        const { clientState, decoder, updateState } = simulateState(() => new PrimitiveCollectionsState());
        updateState((s) => { s.numbers.push(10); });

        const { result } = renderHook(() => useColyseusState(clientState, decoder));
        const before = result.current.numbers;

        act(() => { updateState((s) => { s.numbers.push(20); }); });

        expect(result.current.numbers).not.toBe(before);
        expect(Array.from(result.current.numbers)).toEqual([10, 20]);
    });

    test('unrelated change keeps primitive array reference stable', () => {
        const { clientState, decoder, updateState } = simulateState(() => new PrimitiveCollectionsState());
        updateState((s) => { s.numbers.push(1, 2, 3); });

        const { result } = renderHook(() => useColyseusState(clientState, decoder));
        const before = result.current.numbers;

        act(() => { updateState((s) => { s.tick++; }); });

        expect(result.current.numbers).toBe(before);
    });

    test('mutating a primitive in place changes the array reference', () => {
        const { clientState, decoder, updateState } = simulateState(() => new PrimitiveCollectionsState());
        updateState((s) => { s.numbers.push(1, 2, 3); });

        const { result } = renderHook(() => useColyseusState(clientState, decoder));
        const before = result.current.numbers;

        act(() => { updateState((s) => { s.numbers[1] = 99; }); });

        expect(result.current.numbers).not.toBe(before);
        expect(result.current.numbers[1]).toBe(99);
    });
});

describe('primitive ArraySchema<string>', () => {
    test('snapshots to plain string[]', () => {
        const { clientState, decoder, updateState } = simulateState(() => new PrimitiveCollectionsState());
        updateState((s) => { s.strings.push("a", "b"); });

        const { result } = renderHook(() => useColyseusState(clientState, decoder));
        expect(Array.from(result.current.strings)).toEqual(["a", "b"]);
    });
});

describe('primitive MapSchema<number>', () => {
    test('snapshots to plain Record<string, number>', () => {
        const { clientState, decoder, updateState } = simulateState(() => new PrimitiveCollectionsState());
        updateState((s) => { s.scores.set("alice", 10).set("bob", 20); });

        const { result } = renderHook(() => useColyseusState(clientState, decoder));

        expect(result.current.scores).toEqual({ alice: 10, bob: 20 });
    });

    test('updating one key creates new map reference', () => {
        const { clientState, decoder, updateState } = simulateState(() => new PrimitiveCollectionsState());
        updateState((s) => { s.scores.set("alice", 10).set("bob", 20); });

        const { result } = renderHook(() => useColyseusState(clientState, decoder));
        const before = result.current.scores;

        act(() => { updateState((s) => { s.scores.set("alice", 11); }); });

        expect(result.current.scores).not.toBe(before);
        expect(result.current.scores.alice).toBe(11);
        expect(result.current.scores.bob).toBe(20);
    });

    test('deleting a key creates new map reference', () => {
        const { clientState, decoder, updateState } = simulateState(() => new PrimitiveCollectionsState());
        updateState((s) => { s.scores.set("alice", 10).set("bob", 20); });

        const { result } = renderHook(() => useColyseusState(clientState, decoder));
        const before = result.current.scores;

        act(() => { updateState((s) => { s.scores.delete("bob"); }); });

        expect(result.current.scores).not.toBe(before);
        expect(result.current.scores).toEqual({ alice: 10 });
    });

    test('unrelated change keeps primitive map reference stable', () => {
        const { clientState, decoder, updateState } = simulateState(() => new PrimitiveCollectionsState());
        updateState((s) => { s.scores.set("alice", 10); });

        const { result } = renderHook(() => useColyseusState(clientState, decoder));
        const before = result.current.scores;

        act(() => { updateState((s) => { s.tick++; }); });

        expect(result.current.scores).toBe(before);
    });
});
