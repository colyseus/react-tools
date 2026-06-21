import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';
import { renderHook, act } from '@testing-library/react';
import { useColyseusState } from '../schema/useColyseusState';
import { getOrCreateSubscription } from '../schema/getOrCreateSubscription';
import { simulateState } from './schema/simulateState';

class Entity extends Schema {
  @type('number') x = 0;
  @type(['string']) tags = new ArraySchema<string>();
}
class RoomState extends Schema {
  @type('number') tick = 0;
  @type({ map: Entity }) entities = new MapSchema<Entity>();
}

const sizes = (sub: ReturnType<typeof getOrCreateSubscription>) => ({
  dirty: sub.dirtyRefIds.size,
  results: sub.resultsByRefId.size,
  parents: sub.parentRefIdMap.size,
});

describe('memory growth under entity churn', () => {
  test('dead-entity entries are fully reclaimed by the prune (once it next runs)', () => {
    const { clientState, decoder, updateState } = simulateState(() => new RoomState());
    const sub = getOrCreateSubscription(clientState, decoder);

    renderHook(() => useColyseusState(clientState, decoder, (s: RoomState) => s.entities));

    for (let i = 0; i < 60; i++) {
      act(() => updateState((s) => {
        const e = new Entity();
        e.tags.push('t' + i);
        s.entities.set('e' + i, e);
      }));
      act(() => updateState((s) => { s.entities.delete('e' + i); }));
    }

    // Stop churning; emit benign root-only changes so the prune runs again with
    // nothing dead-since-last-prune left to keep.
    for (let i = 0; i < 100; i++) {
      act(() => updateState((s) => { s.tick++; }));
    }

    const liveRefs = decoder.root!.refs.size; // root + entities map
    const after = sizes(sub);
    // eslint-disable-next-line no-console
    console.log('live decoder refs =', liveRefs, '| map sizes after clean prune =', JSON.stringify(after));

    expect(clientState.entities.size).toBe(0);
    // No dead-entity entries survive: snapshot caches reclaim to the live set,
    // and the dirty set holds at most the still-live refs.
    expect(after.results).toBeLessThanOrEqual(liveRefs);
    expect(after.parents).toBeLessThanOrEqual(liveRefs);
    expect(after.dirty).toBeLessThanOrEqual(liveRefs);
  });

  test('between prunes the footprint is a bounded sawtooth (≤ churn since last prune)', () => {
    const { clientState, decoder, updateState } = simulateState(() => new RoomState());
    const sub = getOrCreateSubscription(clientState, decoder);

    renderHook(() => useColyseusState(clientState, decoder, (s: RoomState) => s.entities));

    let peak = 0;
    for (let i = 0; i < 200; i++) {
      act(() => updateState((s) => {
        const e = new Entity();
        e.tags.push('t' + i);
        s.entities.set('e' + i, e);
      }));
      act(() => updateState((s) => { s.entities.delete('e' + i); }));
      peak = Math.max(peak, sub.resultsByRefId.size);
    }
    // eslint-disable-next-line no-console
    console.log('peak resultsByRefId during 200-entity churn =', peak, '| live refs =', decoder.root!.refs.size);

    // Bounded by the prune window, not the total number of entities ever seen.
    expect(peak).toBeLessThan(400);
  });

  test('dirtyRefIds never grows while the room decodes with NO hook mounted', () => {
    const { clientState, decoder, updateState } = simulateState(() => new RoomState());
    const sub = getOrCreateSubscription(clientState, decoder);

    // Never mount a hook → nothing is cached → nothing is marked dirty (a mark is
    // only added for refs already in resultsByRefId). So no accumulation, no sweep.
    let peak = 0;
    for (let i = 0; i < 500; i++) {
      updateState((s) => {
        const e = new Entity();
        e.tags.push('t' + i);
        s.entities.set('e' + i, e);
      });
      updateState((s) => { s.entities.delete('e' + i); });
      peak = Math.max(peak, sub.dirtyRefIds.size);
    }
    // eslint-disable-next-line no-console
    console.log('peak dirtyRefIds (unmounted, 500 churns) =', peak, '| results =', sub.resultsByRefId.size);

    expect(sub.resultsByRefId.size).toBe(0);
    expect(peak).toBe(0); // dirtyRefIds ⊆ resultsByRefId, which stayed empty
  });

  test('dirtyRefIds never exceeds the cache (its superset)', () => {
    const { clientState, decoder, updateState } = simulateState(() => new RoomState());
    const sub = getOrCreateSubscription(clientState, decoder);

    // Mount so a cache exists, then drive churn while mounted and verify the
    // invariant dirtyRefIds ⊆ resultsByRefId holds at every step.
    renderHook(() => useColyseusState(clientState, decoder, (s: RoomState) => s.entities));
    for (let i = 0; i < 200; i++) {
      act(() => updateState((s) => {
        const e = new Entity();
        e.tags.push('t' + i);
        s.entities.set('e' + i, e);
      }));
      act(() => updateState((s) => { s.entities.get('e' + i)!.tags.push('more'); }));
      expect(sub.dirtyRefIds.size).toBeLessThanOrEqual(sub.resultsByRefId.size);
    }
  });
});
