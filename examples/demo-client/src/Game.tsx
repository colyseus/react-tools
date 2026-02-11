import { MyRoomState } from 'demo-shared/MyRoomState'
import { useRoomState } from '../../../src'; // Importing from library source for now
import './Game.css'
import { Room } from '@colyseus/sdk';

type Props = {
  room: Room<{ state: MyRoomState }>;
}

export const Game = ({ room }: Props) => {
  const state = useRoomState(room);

  if (!state) {
    return <div>Loading state...</div>
  }

  if (!state.players) {
    return <div>state has no players...  <br /> {state.myString}</div>
  }

  return (
    <div className="game">
      <div>String: {state.myString}</div>
      <div>Players:</div>
      <ul>
        {Object.values(state.players).map(player => (
          <li key={player.name}>{player.name} - ({player.position.x}, {player.position.y})</li>
        ))}
      </ul>
    </div>
  );
}
