import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

export class PrimitiveCollectionsState extends Schema {
    @type(["number"]) numbers = new ArraySchema<number>();
    @type(["string"]) strings = new ArraySchema<string>();
    @type({ map: "number" }) scores = new MapSchema<number>();
    @type({ map: "string" }) labels = new MapSchema<string>();
    @type("number") tick = 0;
}
