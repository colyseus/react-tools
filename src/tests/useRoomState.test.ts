import 'reflect-metadata';
import { renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest'
import { useRoomState } from '../schema/useRoomState';
import { Schema, type } from '@colyseus/schema';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Room } from '@colyseus/sdk';
import { simulateState } from './schema/simulateState';
import { MyRoomState } from './schema/MyRoomState';

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

describe('server rendering', () => {
    test('renders without falling back to client rendering', () => {
        function Probe() {
            const state = useRoomState(undefined);
            return React.createElement('span', null, state === undefined ? 'no-state' : 'has-state');
        }

        expect(renderToString(React.createElement(Probe))).toContain('no-state');
    });

    test('a live room still yields an empty server snapshot', () => {
        const sim = simulateState(() => new MyRoomState());
        const room = {
            state: sim.clientState,
            serializer: { decoder: sim.decoder },
        } as unknown as Room<unknown, MyRoomState>;

        function Probe() {
            const state = useRoomState(room);
            return React.createElement('span', null, state === undefined ? 'no-state' : 'has-state');
        }

        expect(renderToString(React.createElement(Probe))).toContain('no-state');
    });
});
