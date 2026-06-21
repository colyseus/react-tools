import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';
import { renderHook, render, act } from '@testing-library/react';
import { useColyseusState } from '../schema/useColyseusState';
import { simulateState } from './schema/simulateState';

/**
 * Follow-up to https://github.com/colyseus/react-tools/issues/10#issuecomment-4759922684
 *
 * The reporter said 0.1.16 did not fix it and gave a "more direct repro" using a
 * key→value indirection (`useOwnValueTypes`). These tests pin down what is and
 * isn't a library bug:
 *
 *  - The library DOES correctly update a nested ArraySchema inside a MapSchema
 *    while the hook stays mounted — even when the selector returns `undefined`
 *    at mount and the subtree only appears across later, separate decodes.
 *  - The reporter's symptom ("remains []", "refresh fixes it, live doesn't")
 *    comes from their own code calling a hook inside `Array.map()`, which
 *    violates the Rules of Hooks. The corrected, hooks-at-top-level version
 *    updates live.
 */

class ValueType extends Schema {
  @type('string') id = '';
  @type('string') metadata = '';
}
class Player extends Schema {
  @type(['string']) keyArray = new ArraySchema<string>();
}
class RoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type([ValueType]) valueTypeArray = new ArraySchema<ValueType>();
}

describe('issue #10 follow-up: nested ArraySchema in MapSchema, mounted', () => {
  // The library handles the reported schema shape correctly while mounted.
  test('selector undefined at mount → player added → keyArray pushed (separate decodes)', () => {
    const { clientState, decoder, updateState } = simulateState(() => new RoomState());

    const sel = (s: RoomState) => s.players.get('sess')?.keyArray;
    const h = renderHook(() => useColyseusState(clientState, decoder, sel));
    expect(h.result.current).toBeUndefined();

    act(() => { updateState((s) => s.players.set('sess', new Player())); });
    expect(Array.from(h.result.current ?? ['MISSING'])).toEqual([]);

    act(() => { updateState((s) => s.players.get('sess')!.keyArray.push('k1')); });
    expect(Array.from(clientState.players.get('sess')!.keyArray)).toEqual(['k1']); // live
    expect(Array.from(h.result.current ?? ['STALE'])).toEqual(['k1']);            // snapshot
  });

  // Still correct when the nested-array hook mounts late, after a warm cache.
  test('keyArray selector mounts late, after the player + a sibling are already cached', () => {
    const { clientState, decoder, updateState } = simulateState(() => new RoomState());

    const root = renderHook(() => useColyseusState(clientState, decoder));
    act(() => { updateState((s) => s.players.set('sess', new Player())); });
    act(() => { updateState((s) => s.valueTypeArray.push(Object.assign(new ValueType(), { id: 'x' }))); });

    const sel = (s: RoomState) => s.players.get('sess')?.keyArray;
    const h = renderHook(() => useColyseusState(clientState, decoder, sel));
    expect(Array.from(h.result.current ?? ['MISSING'])).toEqual([]);

    act(() => { updateState((s) => s.players.get('sess')!.keyArray.push('k1')); });
    expect(Array.from(h.result.current ?? ['STALE'])).toEqual(['k1']);
    expect(root.result.current.players.sess.keyArray.length).toBe(1);
  });

  // The reporter's actual code: calling a hook inside Array.map() throws as soon
  // as the array length changes — this is the cause of "remains []", not the lib.
  test('hook-inside-map (reporter pattern) throws once keyArray length changes', () => {
    const { clientState, decoder, updateState } = simulateState(() => new RoomState());

    function useValueType(key: string) {
      const arr = useColyseusState(clientState, decoder, (s: RoomState) => s.valueTypeArray);
      return (arr ?? []).find((v: any) => v.id === key);
    }
    function Probe() {
      const keyArray = useColyseusState(clientState, decoder, (s: RoomState) => s.players.get('sess')?.keyArray);
      (keyArray ?? []).map((id: string) => useValueType(id)); // ← Rules of Hooks violation
      return null;
    }

    render(<Probe />);
    expect(() => {
      act(() => {
        updateState((s) => {
          s.players.set('sess', new Player());
          s.players.get('sess')!.keyArray.push('a'); // 0 → 1 hooks: React throws
        });
      });
    }).toThrow(/Rendered more hooks|order of Hooks/);
  });

  // The corrected version — hooks at top level, mapping derived with plain JS — updates live.
  test('corrected indirection (no hooks-in-loop) updates live', () => {
    const { clientState, decoder, updateState } = simulateState(() => new RoomState());

    function useOwnValueTypes() {
      const keyArray = useColyseusState(clientState, decoder, (s: RoomState) => s.players.get('sess')?.keyArray);
      const valueTypeArray = useColyseusState(clientState, decoder, (s: RoomState) => s.valueTypeArray);
      const all = valueTypeArray ?? [];
      return (keyArray ?? []).map((id: string) => all.find((v: any) => v.id === id)).filter(Boolean);
    }

    const seen: any[][] = [];
    function Probe() {
      seen.push(useOwnValueTypes().map((v: any) => v?.id ?? null));
      return null;
    }

    render(<Probe />);
    act(() => {
      updateState((s) => {
        s.players.set('sess', new Player());
        s.valueTypeArray.push(Object.assign(new ValueType(), { id: 'a', metadata: 'A' }));
        s.valueTypeArray.push(Object.assign(new ValueType(), { id: 'b', metadata: 'B' }));
      });
    });
    act(() => { updateState((s) => s.players.get('sess')!.keyArray.push('a')); });
    act(() => { updateState((s) => s.players.get('sess')!.keyArray.push('b')); });

    expect(seen[seen.length - 1]).toEqual(['a', 'b']);
  });
});
