import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

/** Mirrors the schema from https://github.com/colyseus/react-tools/issues/10 */
export class TaggedItem extends Schema {
  @type('string') label: string = "";
  @type(['string']) tags = new ArraySchema<string>();
}

export class TaggedItemsState extends Schema {
  @type({ map: TaggedItem }) items = new MapSchema<TaggedItem>();
}
