import { renderHook, act } from '@testing-library/react';
import { expect, test } from 'vitest'
import { useRoomState } from '../schema/useRoomState';
import { simulateState } from '../schema/simulateState';
import { MyRoomState } from '../schema/MyRoomState';

test('reassign field on root object', () => {
    const { clientState, updateState, getStateCallbacks } = simulateState(() => new MyRoomState());
    
    const { result } = renderHook(() => useRoomState(clientState, getStateCallbacks));

    const firstImmutableState = result.current;

    act(() => {
        updateState((state) => {
            state.myString = "New Value";
        });
    });

    const secondImmutableState = result.current;

    // The root object reference should have changed.
    expect(firstImmutableState).not.toBe(secondImmutableState);

    // The modified field should have changed.
    expect(firstImmutableState.myString).toBe("Hello world!");
    expect(secondImmutableState.myString).toBe("New Value");

    // The players object should not have changed: it should be the same reference.
    expect(firstImmutableState.players).toBe(secondImmutableState.players);
})