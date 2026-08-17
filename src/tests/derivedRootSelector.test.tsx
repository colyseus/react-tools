import 'reflect-metadata';
import { act, renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import { useColyseusState } from '../schema/useColyseusState';
import { MyRoomState, Player } from './schema/MyRoomState';
import { simulateState } from './schema/simulateState';

test('a selector-derived root array is stable when the store has not changed', () => {
    const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());
    updateState((state) => {
        state.players.set('p1', new Player().assign({ name: 'P1' }));
    });

    expect(() => {
        const hook = renderHook(() =>
            useColyseusState(clientState, decoder, (state) => Array.from(state.players.values()))
        );
        hook.unmount();
    }).not.toThrow();
});

test('a selector-derived root object remains stable and still updates after a decode', () => {
    const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());
    const { result } = renderHook(() =>
        useColyseusState(clientState, decoder, (state) => ({ message: state.myString }))
    );
    const before = result.current;

    expect(result.current).toBe(before);

    act(() => {
        updateState((state) => {
            state.myString = 'updated';
        });
    });

    expect(result.current).not.toBe(before);
    expect(result.current).toEqual({ message: 'updated' });
});
