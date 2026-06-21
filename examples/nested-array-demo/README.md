# #10 — nested `ArraySchema` in `MapSchema` demo

A self-contained, in-browser reproduction of
[issue #10](https://github.com/colyseus/react-tools/issues/10) and its fix.

A simulated Colyseus server (an `Encoder`/`Decoder` pair — no network) streams
patches into `items.get(key).tags` and feeds the **identical bytes** to two
clients:

- **Fixed** — the current `useColyseusState` (imported from `../../src`).
- **Legacy** — a faithful re-implementation of the snapshot engine *before* the
  fix (`src/legacy.ts`), with the one bug clearly marked.

Each item card compares the hook **snapshot** against that client's own **live**
decoded state, so you can see the snapshot go stale while the live state stays
correct — exactly what the reporter described.

## Run

From the repo root:

```bash
npm run demo
```

(or `npx vite examples/nested-array-demo`). No separate `npm install` — it uses
the repo's root dependencies and library source.

## What to try

1. **Start stream** — patches flow; both columns stay in sync.
2. **Unmount → stream → remount (reproduce #10)** — the headline button. It
   unmounts the views (as a tab/route switch would), streams two patches into
   the nested arrays while unmounted, then remounts. The **Legacy** column shows
   `STALE ✗` (snapshot missing the tag pushed while away); the **Fixed** column
   stays `in sync ✓`.

The difference is the dirty-tracking strategy: Legacy clears its dirty set every
decode (so a later decode wipes an earlier one's marks), while the fix uses
monotonic per-`refId` versions that are never cleared.
