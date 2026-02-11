import { Room } from '@colyseus/core';
import { MyRoomState, Player, Position } from '../../demo-shared/MyRoomState';

export class MyRoom extends Room<{ state: MyRoomState }> {
  state = new MyRoomState();

  onCreate() {
    console.log("Room created!", this.roomId);

    const pos1 = new Position();
    pos1.x = 0;
    pos1.y = 0;

    const player1 = new Player();
    player1.name = "Alice";
    player1.position = pos1;

    const pos2 = new Position();
    pos2.x = 100;
    pos2.y = 100;

    const player2 = new Player();
    player2.name = "Bob";
    player2.position = pos2;

    this.state.players.set('1', player1);
    this.state.players.set('2', player2);

    this.setSimulationInterval(() => this.update(), 2000);
  }

  private updateNumber = 0;

  update() {
    this.state.myString = `Update #${this.updateNumber++}`;
    
    this.state.players.forEach(player => {
      player.position.x += 10;
    });
  }
}
