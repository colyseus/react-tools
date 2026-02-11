import { useRoomConnection } from './useRoomConnection';
import './App.css'
import { Game } from './Game';

function App() {
  const room = useRoomConnection();
  
  if (room) {
    return <Game room={room} />
  } else {
    return <div>Connecting to room...</div>
  }
}

export default App
