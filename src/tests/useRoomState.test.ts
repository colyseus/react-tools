import 'reflect-metadata';
import { renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest'
import { useRoomState } from '../schema/useRoomState';
import { Schema, type } from '@colyseus/schema';

describe('falsy room argument', () => {
    test('types', () => {
        class MySchema extends Schema {
            @type("string") myField: string = "hello";
        }
        class Room {
            '~state': MySchema;
        }
        const schemaField = renderHook(() => useRoomState<MySchema>((s) => s.myField));
        const roomField = renderHook(() => useRoomState<Room>((s) => s.myField));
    })

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
