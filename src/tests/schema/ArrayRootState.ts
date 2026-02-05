import { ArraySchema, Schema, type } from "@colyseus/schema";

/**
 * A simple schema object to use in arrays
 */
export class Task extends Schema {
  constructor(title: string = "", completed: boolean = false) {
    super();
    this.title = title;
    this.completed = completed;
  }
  @type('string') title: string;
  @type('boolean') completed: boolean;
  @type('number') priority: number = 0;
}

/**
 * State with an array at the root level
 */
export class ArrayRootState extends Schema {
  @type([Task]) tasks = new ArraySchema<Task>();
  @type('number') version: number = 0;
}
