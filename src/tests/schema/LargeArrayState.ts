import { Schema, type, ArraySchema } from "@colyseus/schema";

export class Cell extends Schema {
    @type("number") value: number = 0;
    @type("boolean") revealed: boolean = false;
}

export class LargeArrayState extends Schema {
    @type([Cell]) cells = new ArraySchema<Cell>();
    @type("number") counter: number = 0;
}