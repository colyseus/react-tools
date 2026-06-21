import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';
import { createSnapshot, type SnapshotContext } from '../schema/createSnapshot';
import { getOrCreateSubscription } from '../schema/getOrCreateSubscription';
import { simulateState } from './schema/simulateState';

/**
 * Repro for the still-open part of issue #10.
 *
 * Two hooks share one subscription (per room.state): a BUSY one — e.g.
 * `useRoomState(s => s.gameState)` ticking constantly — and one reading a
 * nested ArraySchema — `useRoomState(s => s.players.get(id)?.keyArray)`.
 *
 * The dirty set is SHARED across all hooks and a single boolean decides when it
 * clears. When the nested array's mark is set by one decode but a DIFFERENT
 * hook runs getSnapshot before the nested hook re-renders, the next decode
 * clears the still-unconsumed mark, and the nested hook short-circuits to its
 * stale cached snapshot — exactly the reporter's "busy render-trigger works,
 * nested selector stays []" symptom.
 *
 * `act()`-wrapped tests never see this because act() flushes every hook's
 * getSnapshot synchronously inside the decode's notify(), before the next
 * decode can run. Real decodes arrive on separate WebSocket tasks, so React
 * can re-render one consumer before another with a decode landing in between.
 * This test reproduces that exact ordering against the real decode wrapper and
 * real createSnapshot.
 */

class Player extends Schema {
  @type(['string']) keyArray = new ArraySchema<string>();
}
class RoomState extends Schema {
  @type('number') gameState = 0;
  @type({ map: Player }) players = new MapSchema<Player>();
}

// Before the fix this interleaving left the nested hook stale: the shared dirty
// set was bulk-cleared at the start of every decode, so a second decode wiped the
// first's not-yet-consumed mark and the nested hook short-circuited to its old
// snapshot. Now a mark is removed only when a snapshot actually rebuilds that ref,
// so it survives until the nested hook re-renders and consumes it.
describe('issue #10: nested hook stays fresh across async hook re-renders', () => {
  // Faithfully mimics useColyseusState's getSnapshot for one selector.
  function makeConsume(clientState: RoomState, decoder: any, sub: ReturnType<typeof getOrCreateSubscription>) {
    return function consume<U>(selector: (s: RoomState) => U): U {
      const selected = selector(clientState);
      sub.visitedThisPass.clear();
      const ctx: SnapshotContext = {
        refs: decoder.root?.refs,
        resultsByRefId: sub.resultsByRefId,
        visitedThisPass: sub.visitedThisPass,
        dirtyRefIds: sub.dirtyRefIds,
        parentRefIdMap: sub.parentRefIdMap,
        currentParentRefId: -1,
      };
      const result = createSnapshot(selected, ctx);
      return result as U;
    };
  }

  const selGame = (s: RoomState) => s.gameState;
  const selKeys = (s: RoomState) => s.players.get('sess')?.keyArray;

  test('nested keyArray hook stays fresh when a busy hook re-renders between decodes', () => {
    const { clientState, decoder, updateState } = simulateState(() => new RoomState());
    updateState((s) => s.players.set('sess', new Player()));

    const sub = getOrCreateSubscription(clientState, decoder);
    const consume = makeConsume(clientState, decoder, sub);

    // Both hooks mount and build their caches.
    consume(selGame);
    expect(Array.from(consume(selKeys) ?? [])).toEqual([]);

    // --- async interleaving that React produces (and act() hides) ---
    // decode 1: server pushes into the nested keyArray → its mark is set
    updateState((s) => s.players.get('sess')!.keyArray.push('a'));
    // the BUSY gameState hook re-renders first and consumes the dirty marks
    consume(selGame);
    // decode 2: gameState ticks → clears the dirty set, wiping keyArray's mark
    updateState((s) => { s.gameState++; });
    // only NOW does the nested keyArray hook re-render
    const keys = consume(selKeys);

    // live state is correct...
    expect(Array.from(clientState.players.get('sess')!.keyArray)).toEqual(['a']);
    // ...but the snapshot is stale: keyArray's mark was cleared before it rendered
    expect(Array.from(keys ?? [])).toEqual(['a']);
  });

  test('control: same decodes, but keyArray hook consumes BEFORE the 2nd decode → fine', () => {
    const { clientState, decoder, updateState } = simulateState(() => new RoomState());
    updateState((s) => s.players.set('sess', new Player()));

    const sub = getOrCreateSubscription(clientState, decoder);
    const consume = makeConsume(clientState, decoder, sub);

    consume(selGame);
    expect(Array.from(consume(selKeys) ?? [])).toEqual([]);

    updateState((s) => s.players.get('sess')!.keyArray.push('a'));
    expect(Array.from(consume(selKeys) ?? [])).toEqual(['a']); // consumes in time
    updateState((s) => { s.gameState++; });
    consume(selGame);
    expect(Array.from(consume(selKeys) ?? [])).toEqual(['a']); // stays correct
  });
});
