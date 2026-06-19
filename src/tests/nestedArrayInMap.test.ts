import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useColyseusState } from '../schema/useColyseusState';
import { simulateState } from './schema/simulateState';
import { TaggedItem, TaggedItemsState } from './schema/TaggedItemsState';

/**
 * Regression for https://github.com/colyseus/react-tools/issues/10
 *
 * A nested ArraySchema (an item's `tags` inside a MapSchema) showed a stale
 * value after the component remounted: the live decoded state was correct, but
 * the snapshot kept the old `[]`.
 *
 * The trigger is *two or more decodes with no snapshot in between*. While the
 * hook is mounted, `useSyncExternalStore` runs `getSnapshot` on every store
 * notification, so plain render-batching does NOT cause it (verified against a
 * real Colyseus server). It happens when the hook is *not subscribed* while
 * patches arrive — the component is unmounted on a route/tab switch, behind a
 * conditional, virtualized out of a list, etc. — and then remounts.
 *
 * Dirty tracking used to clear its set at the start of every decode, so the
 * second decode wiped the first decode's marks; the freshly-pushed ref's
 * ancestors were no longer marked dirty and the remount snapshot
 * short-circuited the stale subtree.
 */
describe('issue #10: nested ArraySchema in MapSchema, decodes while unmounted', () => {
  const sel = (s: TaggedItemsState) => s.items;

  test('a nested push that arrives while unmounted is reflected after remount', () => {
    const { clientState, decoder, updateState } = simulateState(() => new TaggedItemsState());

    updateState((s) => s.items.set('a', new TaggedItem()));

    // mount once: item 'a' is snapshotted with tags == []
    const h1 = renderHook(() => useColyseusState(clientState, decoder, sel));
    expect(Array.from(h1.result.current.a.tags)).toEqual([]);
    h1.unmount();

    // two decodes land while no hook is subscribed (no getSnapshot between them)
    updateState((s) => s.items.get('a')!.tags.push('hello'));
    updateState((s) => s.items.set('b', new TaggedItem()));

    // remount: the first snapshot must reflect everything that changed while away
    const h2 = renderHook(() => useColyseusState(clientState, decoder, sel));
    expect(Array.from(clientState.items.get('a')!.tags)).toEqual(['hello']); // live state
    expect(h2.result.current.b).toBeDefined();                               // sibling change
    expect(Array.from(h2.result.current.a.tags)).toEqual(['hello']);         // nested push
  });

  test('item added while unmounted, with a nested push, both appear after remount', () => {
    const { clientState, decoder, updateState } = simulateState(() => new TaggedItemsState());

    // mount with an empty map so the root/map snapshots are already cached
    const h1 = renderHook(() => useColyseusState(clientState, decoder, sel));
    expect(Object.keys(h1.result.current)).toEqual([]);
    h1.unmount();

    updateState((s) => s.items.set('a', new TaggedItem()));
    updateState((s) => s.items.get('a')!.tags.push('x'));

    const h2 = renderHook(() => useColyseusState(clientState, decoder, sel));
    expect(h2.result.current.a).toBeDefined();
    expect(Array.from(h2.result.current.a.tags)).toEqual(['x']);
  });
});
