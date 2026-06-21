/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
// The FIXED hook — imported straight from the library source, so this demo
// exercises the real, current implementation.
import { useColyseusState } from "../../../src/schema/useColyseusState";
import { useLegacyColyseusState } from "./legacy";
import { SimulatedServer, type Client } from "./server";
import type { RoomState } from "./schema";

type ItemsSnapshot = Record<string, { label: string; tags: readonly string[] }> | undefined;

function useSetup() {
  const ref = useRef<{ server: SimulatedServer; fixed: Client; legacy: Client }>();
  if (!ref.current) {
    const server = new SimulatedServer();
    const fixed = server.addClient();
    const legacy = server.addClient();
    server.boot();
    ref.current = { server, fixed, legacy };
  }
  return ref.current;
}

function Chips({ tags }: { tags: readonly string[] | null }) {
  if (tags === null) return <em className="missing">(no snapshot)</em>;
  if (tags.length === 0) return <em className="empty">(empty)</em>;
  return (
    <span className="chips">
      {tags.map((t, i) => (
        <span className="chip" key={i}>{t}</span>
      ))}
    </span>
  );
}

function ItemsView({ client, kind }: { client: Client; kind: "fixed" | "legacy" }) {
  const useHook = kind === "fixed" ? useColyseusState : useLegacyColyseusState;
  // selector: the nested ArraySchema-in-MapSchema that goes stale in #10.
  const snap = useHook(client.state, client.decoder, (s: RoomState) => s.items) as ItemsSnapshot;

  const state = client.state as RoomState;
  const liveKeys = Array.from(state.items.keys());

  if (liveKeys.length === 0) return <div className="empty-note">no items yet</div>;

  return (
    <div className="items">
      {liveKeys.map((key) => {
        const live = state.items.get(key)!;
        const liveTags = Array.from(live.tags);
        const snapItem = snap?.[key];
        const snapTags = snapItem ? Array.from(snapItem.tags) : null;
        const stale = !snapTags || snapTags.join("|") !== liveTags.join("|");
        return (
          <div className={`card ${stale ? "stale" : "synced"}`} key={key}>
            <div className="card-head">
              <strong>{live.label}</strong>
              <span className={`pill ${stale ? "bad" : "good"}`}>{stale ? "STALE ✗" : "in sync ✓"}</span>
            </div>
            <div className="row">
              <span className="lbl">snapshot (hook)</span>
              <Chips tags={snapTags} />
            </div>
            <div className="row">
              <span className="lbl">live state</span>
              <Chips tags={liveTags} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Board({ title, subtitle, kind, client, mounted }: {
  title: string; subtitle: string; kind: "fixed" | "legacy"; client: Client; mounted: boolean;
}) {
  return (
    <section className={`board ${kind}`}>
      <header>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>
      {mounted ? (
        <ItemsView client={client} kind={kind} />
      ) : (
        <div className="unmounted">⏸ view unmounted — simulating a tab / route switch</div>
      )}
    </section>
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function App() {
  const { server, fixed, legacy } = useSetup();
  const [running, setRunning] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [, force] = useState(0);

  // Refresh the header (tick counter) on every decode.
  useEffect(() => server.onDecode(() => force((n) => n + 1)), [server]);

  const toggleStream = () => {
    if (running) server.stop();
    else server.start(900);
    setRunning(server.running);
  };

  // The deterministic #10 reproduction: stream nested-array patches while the
  // view is unmounted, then remount and compare.
  const runRepro = async () => {
    server.stop();
    setRunning(false);
    setMounted(false);
    await wait(80); // let React commit the unmount
    server.pushTagToAll("WHILE-AWAY"); // decode 1: nested push into every item
    server.tick(); // decode 2: touches only root → wipes the pre-fix item marks
    await wait(80);
    setMounted(true); // remount → legacy is stale, fixed is fresh
  };

  return (
    <div className="app">
      <h1>Nested <code>ArraySchema</code> inside <code>MapSchema</code> — issue #10</h1>
      <p className="lede">
        A simulated server streams patches into <code>items.get(key).tags</code> and feeds the
        identical bytes to two clients. The <strong>Fixed</strong> client uses the current
        <code> useColyseusState</code>; the <strong>Legacy</strong> client uses the snapshot engine
        from before the fix. Each card compares the hook <em>snapshot</em> against that client's own
        <em> live</em> decoded state.
      </p>

      <div className="controls">
        <button onClick={toggleStream} className={running ? "danger" : "primary"}>
          {running ? "⏸ Pause stream" : "▶ Start stream"}
        </button>
        <button onClick={() => server.addItem()}>＋ Add item</button>
        <button onClick={() => server.pushTagRandom(`tag-${Date.now() % 1000}`)}>＋ Push tag (random item)</button>
        <button onClick={runRepro} className="primary repro">↻ Unmount → stream → remount (reproduce #10)</button>
        <button onClick={() => location.reload()}>Reset</button>
        <span className="tick">server tick: <strong>{server.state.tick}</strong></span>
      </div>

      <p className="hint">
        Tip: click <strong>Unmount → stream → remount</strong>. The Legacy column shows
        <span className="pill bad inline">STALE ✗</span> nested tags (snapshot ≠ live) — exactly the
        reported bug. The Fixed column stays <span className="pill good inline">in sync ✓</span>.
      </p>

      <div className="boards">
        <Board
          title="✅ Fixed"
          subtitle="useColyseusState (current code)"
          kind="fixed"
          client={fixed}
          mounted={mounted}
        />
        <Board
          title="🐞 Legacy"
          subtitle="pre-fix dirty-set tracking"
          kind="legacy"
          client={legacy}
          mounted={mounted}
        />
      </div>
    </div>
  );
}
