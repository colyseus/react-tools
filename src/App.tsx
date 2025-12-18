import './App.css'

import { Player } from './schema/MyRoomState'
import { clientState, simulatePatchState, stateCallbacks } from './schema/simulate';
import { useRoomState as useImmutableRoomState } from './schema/useRoomState';

/**
 * Update the string in the state.
 */
function simulateUpdateString() {
  simulatePatchState((state) => {
    state.myString = "Updated! " + Math.random();
  });
}

/**
 * Add a new player to the state.
 */
function simulateAddPlayer() {
  simulatePatchState((state) => {
    const num = (state.players.size + 1);
    state.players.set(`p-${num}`, new Player().assign({ name: "Player " + num }));
  });
}

/**
 * Remove a random player from the state.
 */
function simulateRemovePlayer() {
  simulatePatchState((state) => {
    const randomKey = Array.from(state.players.keys())[Math.floor(Math.random() * state.players.size)];
    state.players.delete(randomKey);
  });
}

function App() {
  const state = useImmutableRoomState(clientState, stateCallbacks);
  // const players = useRoomState(clientState, stateCallbacks, (state) => state.players);

  return (
    <>
      <h2>State</h2>
      <p><strong><code>.myString</code>:</strong> {state.myString}</p>
      <button onClick={simulateUpdateString}>Update <code>.myString</code></button>
      <hr />

      <h2><strong><code>.players</code></strong></h2>

      {Array.from(Object.entries(state.players).map(([key, value]) => (
        <p key={key}><code>{key}</code> → <code>{JSON.stringify(value)}</code></p>
      )))}

      <hr />
      <button onClick={simulateAddPlayer}>Add player</button>
      <button onClick={simulateRemovePlayer}>Remove player</button>
    </>
  )
}

export default App
