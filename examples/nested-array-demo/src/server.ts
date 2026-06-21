import { Encoder, Decoder } from "@colyseus/schema";
import { Item, RoomState } from "./schema";

export interface Client {
  state: RoomState;
  decoder: Decoder<RoomState>;
}

/**
 * An in-browser stand-in for a Colyseus server. It mutates an authoritative
 * `RoomState`, encodes the patch, and decodes the *same bytes* into every
 * registered client — exactly what the wire does, minus the network. Calling
 * `discardChanges()` after each encode keeps every patch a clean delta.
 */
export class SimulatedServer {
  readonly state = new RoomState();
  private readonly encoder = new Encoder(this.state);
  private readonly clients: Decoder<RoomState>[] = [];
  private readonly decodeListeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextId = 1;
  private autoStep = 0;

  /** Register a client that will receive every future patch. */
  addClient(): Client {
    const state = new RoomState();
    const decoder = new Decoder(state);
    this.clients.push(decoder);
    return { state, decoder };
  }

  /** Fires after every patch is decoded by all clients. */
  onDecode(cb: () => void): () => void {
    this.decodeListeners.add(cb);
    return () => this.decodeListeners.delete(cb);
  }

  private flush() {
    const bytes = this.encoder.encode();
    if (bytes.byteLength > 0) {
      for (const decoder of this.clients) decoder.decode(new Uint8Array(bytes));
      this.encoder.discardChanges();
      this.decodeListeners.forEach((cb) => cb());
    }
  }

  /** Apply a mutation and broadcast the resulting patch. */
  mutate(fn: (s: RoomState) => void) {
    fn(this.state);
    this.flush();
  }

  /** Seed initial content so there is something to look at on load. */
  boot() {
    this.mutate(() => {}); // initial structure sync
    this.addItem("alpha");
    this.addItem("beta");
    this.pushTagToAll("init");
  }

  addItem(label?: string): string {
    const key = `item-${this.nextId++}`;
    this.mutate((s) => {
      const item = new Item();
      item.label = label ?? key;
      s.items.set(key, item);
    });
    return key;
  }

  /** One decode that pushes a tag into EVERY item's nested array. */
  pushTagToAll(tag: string) {
    this.mutate((s) => s.items.forEach((item) => item.tags.push(tag)));
  }

  pushTagRandom(tag: string) {
    this.mutate((s) => {
      const keys = Array.from(s.items.keys());
      if (keys.length === 0) return;
      const k = keys[Math.floor(Math.random() * keys.length)];
      s.items.get(k)!.tags.push(tag);
    });
  }

  /** One decode that touches only the root `tick` field. */
  tick() {
    this.mutate((s) => { s.tick++; });
  }

  start(intervalMs = 900) {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick(); // busy field every interval
      if (this.autoStep % 2 === 1) this.pushTagRandom(`auto-${this.autoStep}`);
      this.autoStep++;
    }, intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  get running() {
    return this.timer !== null;
  }
}
