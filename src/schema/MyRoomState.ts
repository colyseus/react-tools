import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema"

export class Position extends Schema {
  @type('number') x = 0;
  @type('number') y = 0;
}

export class Item extends Schema {
  constructor(type: string, quantity: number = 1) {
    super();
    this.type = type;
    this.quantity = quantity;
  }
  @type('string') type: string;
  @type('number') quantity: number;
}

export class Player extends Schema {
  @type('string') name: string = "Player";
  @type(Position) position = new Position();
  @type([Item]) inventory = new ArraySchema<Item>();
}

export class MyRoomState extends Schema {
  @type('string') myString = "Hello world!";
  @type({ map: Player }) players = new MapSchema<Player>();
}
