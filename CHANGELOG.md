# Changelog

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
