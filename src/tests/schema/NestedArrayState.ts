import { ArraySchema, Schema, type } from "@colyseus/schema";

/**
 * A message schema for testing nested arrays
 */
export class Message extends Schema {
  constructor(text: string = "", sender: string = "") {
    super();
    this.text = text;
    this.sender = sender;
  }
  @type('string') text: string;
  @type('string') sender: string;
  @type('number') timestamp: number = 0;
}

/**
 * A conversation containing an array of messages
 */
export class Conversation extends Schema {
  constructor(topic: string = "") {
    super();
    this.topic = topic;
  }
  @type('string') topic: string;
  @type([Message]) messages = new ArraySchema<Message>();
  @type('boolean') archived: boolean = false;
}

/**
 * State with nested arrays (array of objects, each containing an array)
 */
export class NestedArrayState extends Schema {
  @type([Conversation]) conversations = new ArraySchema<Conversation>();
  @type('string') activeUser: string = "";
}
