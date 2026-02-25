import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { MyRoom } from './MyRoom';

const gameServer = new Server({
  transport: new WebSocketTransport(),
})

gameServer.define("my_room", MyRoom);

gameServer.listen(2567);
