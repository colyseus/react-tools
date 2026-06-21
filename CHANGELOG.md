# Changelog

## 0.1.17

### Fixes

- Nested `ArraySchema` values inside a `MapSchema` (e.g. `items.get(key).tags`) could still go stale during normal, mounted gameplay — not only across remounts as 0.1.16 addressed. 0.1.16 accumulated the dirty set until a snapshot consumed it, but with several hooks sharing one room subscription, an unrelated hook re-rendering between two decodes could let the next decode clear a mark another hook had not yet consumed, leaving that hook's nested value stale. The dirty set is no longer bulk-cleared on any schedule: a ref's mark is removed only when a snapshot actually rebuilds that ref, so it survives across any number of decodes and unrelated re-renders until the owning hook re-renders and consumes it. Marks are tracked only for refs that already have a cached result (`dirtyRefIds ⊆ resultsByRefId`), which keeps the set bounded by the cache with no extra bookkeeping. Re-render counts and snapshot performance are unchanged. ([#10](https://github.com/colyseus/react-tools/issues/10), follow-up repro by [@konistehrad](https://github.com/konistehrad))

## 0.1.16

### Fixes

- Nested `ArraySchema` values inside a `MapSchema` (e.g. `items.get(key).tags`) could stay stale — the live decoded state was correct, but the snapshot kept the old value. Dirty tracking cleared its set at the start of every decode, so when two or more decodes arrived with no snapshot in between — which happens whenever the hook is not subscribed while patches arrive (the component is unmounted on a route/tab switch, behind a conditional, virtualized out of a list, …) and then remounts — the second decode wiped the first's marks and the snapshot short-circuited the stale subtree. The dirty set now accumulates across decodes and is cleared only once a snapshot has consumed it. ([#10](https://github.com/colyseus/react-tools/issues/10), reported by [@konistehrad](https://github.com/konistehrad))

## 0.1.15

### Performance

- Dropped the per-decode `objectToRefId` reverse-lookup `Map` rebuild. The decoder already tags every Schema/ArraySchema/MapSchema instance with `~refId`, and `DataChange` carries `refId` directly — both are used instead. Eliminates ~137 KB/op of garbage per decode on a 200-player state.
- Unified `previousResultsByRefId` / `currentResultsByRefId` into a single persistent cache plus a reused `visitedThisPass` set. Removes a per-render `Map` allocation and copy loop in `useColyseusState`.
- Memoized `getSchemaFieldNames` per Schema constructor (was `Object.values(metadata).map(...)` on every visit).
- Replaced `Object.keys(prev).length !== Object.keys(next).length` MapSchema size check with a count vs `node.size` comparison (no array allocations).
- Parent-chain dirty walk now short-circuits once it hits an already-dirty ancestor.

Measured on a synthetic "50 of 200 players mutate each tick" benchmark: **~25% faster**, **~99% less allocation** per tick.

### Tests

- +60 tests covering: selectors, primitive `ArraySchema` / `MapSchema`, `Schema` reference reassignment, `MapSchema.clear()`, multiple hooks sharing a subscription, late-binding state/decoder, `useRoomMessage`, `useLobbyRoom`, `useQueueRoom`, `createRoomContext`, `createLobbyContext`, and coexistence with `getDecoderStateCallbacks` (`onAdd` / `onRemove` / `onChange` / `listen`).
- New opt-in microbenchmark at `src/tests/bench.test.ts` (`BENCH=1 NODE_OPTIONS=--expose-gc npx vitest run src/tests/bench.test.ts`).
