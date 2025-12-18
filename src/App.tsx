import { StateDisplay } from './display/StateDisplay';
import { Item, Player } from './schema/MyRoomState'
import { clientState, simulatePatchState, stateCallbacks } from './schema/simulate';
import { useRoomState } from './schema/useRoomState';
import './App.css'

/**
 * Update the string in the state.
 */
function simulateUpdateString() {
  simulatePatchState((state) => {
    state.myString = "Updated! " + Math.round(Math.random() * 1000000) / 1000000;
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

/**
 * Adjust the position of a random player in the state.
 */
function simulateRenamePlayer() {
  simulatePatchState((state) => {
    const randomKey = Array.from(state.players.keys())[Math.floor(Math.random() * state.players.size)];
    const player = state.players.get(randomKey);
    if (player) {
      player.name += ' X';
    }
  });
}

/**
 * Adjust the position of a random player in the state.
 */
function simulateMovePlayer() {
  simulatePatchState((state) => {
    const randomKey = Array.from(state.players.keys())[Math.floor(Math.random() * state.players.size)];
    const player = state.players.get(randomKey);
    if (player) {
      player.position.x = Math.floor(Math.random() * 100);
      player.position.y = Math.floor(Math.random() * 100);
    }
  });
}

/**
 * Add an item to the inventory of a random player in the state.
 */
function simulateAddItem() {
  simulatePatchState((state) => {
    const randomKey = Array.from(state.players.keys())[Math.floor(Math.random() * state.players.size)];
    const player = state.players.get(randomKey);
    if (player) {
      const itemType = ['Sword', 'Shield', 'Potion', 'Bow'][Math.floor(Math.random() * 4)];
      player.inventory.push(new Item(itemType));
    }
  });
}

/**
 * Remove an item from the inventory of a random player in the state.
 */
function simulateRemoveItem() {
  simulatePatchState((state) => {
    const playersWithItems = Array.from(state.players.values()).filter(p => p.inventory.length > 0);
    if (playersWithItems.length === 0) {
      return; // No players with items to remove from.
    }

    const player = playersWithItems[Math.floor(Math.random() * playersWithItems.length)];
    player.inventory.pop();
  });
}

/**
 * Increment the quantity of an item in the inventory of a random player in the state.
 */
function simulateIncrementItem() {
  simulatePatchState((state) => {
    const playersWithItems = Array.from(state.players.values()).filter(p => p.inventory.length > 0);
    if (playersWithItems.length === 0) {
      return; // No players with items to remove from.
    }
    
    const player = playersWithItems[Math.floor(Math.random() * playersWithItems.length)];
    const itemIndex = Math.floor(Math.random() * player.inventory.length);
    player.inventory[itemIndex].quantity += 1;
  });
}

function App() {
  const state = useRoomState(clientState, stateCallbacks);

  return (
    <>
      <StateDisplay state={state} />

      <div className="buttons">
        <button onClick={simulateUpdateString}>Update <code>.myString</code></button>
        <button onClick={simulateAddPlayer}>Add player</button>
        <button onClick={simulateRemovePlayer}>Remove player</button>
        <button onClick={simulateMovePlayer}>Move player</button>
        <button onClick={simulateRenamePlayer}>Rename player</button>
        <button onClick={simulateAddItem}>Add item</button>
        <button onClick={simulateIncrementItem}>Increment item</button>
        <button onClick={simulateRemoveItem}>Remove item</button>
      </div>
    </>
  )
}

export default App
