import 'reflect-metadata';
import { renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest'
import { useRoomState } from '../schema/useRoomState';

describe('falsy room argument', () => {
    test('does not crash when room is null', () => {
        const { result } = renderHook(() => useRoomState(null));
        expect(result.current).toBeUndefined();
    });

    test('does not crash when room is undefined', () => {
        const { result } = renderHook(() => useRoomState(undefined));
        expect(result.current).toBeUndefined();
    });

    test('does not crash when room is null with a selector', () => {
        const { result } = renderHook(() => useRoomState(null, (s) => s));
        expect(result.current).toBeUndefined();
    });

    test('does not crash when room is undefined with a selector', () => {
        const { result } = renderHook(() => useRoomState(undefined, (s) => s));
        expect(result.current).toBeUndefined();
    });
});
