# @colyseus/react

React hooks for [Colyseus](https://colyseus.io/) multiplayer applications.

## Installation

```bash
npm install @colyseus/react
```

**Peer dependencies:** `@colyseus/sdk`, `@colyseus/schema`, and `react` (>=18.3.1).

## Hooks

### `useRoom(callback, deps?)`

Manages the lifecycle of a Colyseus room connection. Handles connecting, disconnecting on unmount, and reconnecting when dependencies change. Works correctly with React StrictMode.

```tsx
import { Client } from "@colyseus/sdk";
import { useRoom } from "@colyseus/react";

const client = new Client("ws://localhost:2567");

function Game() {
  const { room, error, isConnecting } = useRoom(
    () => client.joinOrCreate("game_room"),
  );

  if (isConnecting) return <p>Connecting...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return <GameView room={room} />;
}
```

The first argument is a callback that returns a `Promise<Room>` — any Colyseus matchmaking method works (`joinOrCreate`, `join`, `create`, `joinById`, `consumeSeatReservation`).

**Reconnecting on dependency changes:**

```tsx
const { room } = useRoom(
  () => client.joinOrCreate("game_room", { level }),
  [level],
);
```

When `level` changes the previous room is left and a new connection is established.

**Conditional connection:**

Pass a falsy value to skip connecting until a condition is met:

```tsx
const { room } = useRoom(
  isReady ? () => client.joinOrCreate("game_room") : null,
  [isReady],
);
```

### `useRoomState(room, selector?)`

Subscribes to Colyseus room state changes and returns immutable plain-object snapshots. Unchanged portions of the state tree keep referential equality between renders, so React components only re-render when the data they use actually changes.

```tsx
import { useRoom, useRoomState } from "@colyseus/react";

function Game() {
  const { room } = useRoom(() => client.joinOrCreate("game_room"));
  const state = useRoomState(room);

  if (!state) return <p>Waiting for state...</p>;

  return <p>Players: {state.players.size}</p>;
}
```

**Using a selector** to subscribe to a subset of the state:

```tsx
const players = useRoomState(room, (state) => state.players);
```

Only components that read `players` will re-render when the players map changes.

### `createRoomContext()`

Creates a set of hooks and a `RoomProvider` component that share a single room connection across React reconciler boundaries (e.g. DOM + React Three Fiber). The room is stored in a closure-scoped external store rather than React Context, so the hooks work in any reconciler tree that imports them.

```tsx
import { Client } from "@colyseus/sdk";
import { createRoomContext } from "@colyseus/react";

const client = new Client("ws://localhost:2567");

const { RoomProvider, useRoom, useRoomState } = createRoomContext();
```

**Wrap your app with `RoomProvider`:**

```tsx
function App() {
  return (
    <RoomProvider connect={() => client.joinOrCreate("game_room")}>
      <UI />
      <Canvas>
        <GameScene />
      </Canvas>
    </RoomProvider>
  );
}
```

`RoomProvider` accepts a `connect` callback (same as the standalone `useRoom` hook) and an optional `deps` array. Pass a falsy value to `connect` to defer the connection.

**Use the hooks in any component — DOM or R3F:**

```tsx
function UI() {
  const { room, error, isConnecting } = useRoom();
  const players = useRoomState((state) => state.players);

  if (isConnecting) return <p>Connecting...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return <p>Players: {players?.size}</p>;
}
```

The returned `useRoom()` and `useRoomState(selector?)` work identically to the standalone hooks but don't require you to pass the room as an argument.

## Credits

Inspiration and previous work by [@pedr0fontoura](https://github.com/pedr0fontoura) — [use-colyseus](https://github.com/pedr0fontoura/use-colyseus/).
