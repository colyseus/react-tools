import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

/**
 * The reporter's schema from https://github.com/colyseus/react-tools/issues/10
 * A nested `ArraySchema` (`tags`) living inside a `MapSchema` (`items`).
 */
export class Item extends Schema {
  @type("string") label = "";
  @type(["string"]) tags = new ArraySchema<string>();
}

export class RoomState extends Schema {
  /** A busy, frequently-changing field — mirrors a per-frame `gameState` tick. */
  @type("number") tick = 0;
  @type({ map: Item }) items = new MapSchema<Item>();
}
