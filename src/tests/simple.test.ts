import { renderHook, act } from '@testing-library/react';
import { describe, expect, test } from 'vitest'
import { useRoomState } from '../schema/useRoomState';
import { simulateState } from '../schema/simulateState';
import { MyRoomState, Player } from '../schema/MyRoomState';

test('reassign field on root object', () => {
    const { clientState, updateState, getStateCallbacks } = simulateState(() => new MyRoomState());
    
    const { result } = renderHook(() => useRoomState(clientState, getStateCallbacks));

    const firstImmutableState = result.current;

    act(() => {
        updateState((state) => {
            state.myString = "New Value";
        });
    });

    const secondImmutableState = result.current;

    // The root object reference should have changed.
    expect(firstImmutableState).not.toBe(secondImmutableState);

    // The modified field should have changed.
    expect(firstImmutableState.myString).toBe("Hello world!");
    expect(secondImmutableState.myString).toBe("New Value");

    // The players object should not have changed: it should be the same reference.
    expect(firstImmutableState.players).toBe(secondImmutableState.players);
});

describe('adding & removing players', () => {
    const { clientState, updateState, getStateCallbacks } = simulateState(() => new MyRoomState());
    
    const { result } = renderHook(() => useRoomState(clientState, getStateCallbacks));

    // Put one player into the state.
    act(() => {
        updateState((state) => {
            state.players.set("p1", new Player().assign({ name: "Player 1" }));
        });
    });

    const stateAfterAddingPlayer1 = result.current;

    test('adding players doesn\'t reallocate existing players', () => {
        // Add a second player into the state.
        act(() => {
            updateState((state) => {
                state.players.set("p2", new Player().assign({ name: "Player 2" }));
            });
        });

        const stateAfterAddingPlayer2 = result.current;

        // The root object and players reference should have changed.
        expect(stateAfterAddingPlayer1).not.toBe(stateAfterAddingPlayer2);
        expect(stateAfterAddingPlayer1.players).not.toBe(stateAfterAddingPlayer2.players);

        // The existing player reference should be the same.
        expect(stateAfterAddingPlayer1.players["p1"]).toBe(stateAfterAddingPlayer2.players["p1"]);

        // Add a third player into the state.
        act(() => {
            updateState((state) => {
                state.players.set("p3", new Player().assign({ name: "Player 3" }));
            });
        });

        const stateAfterAddingPlayer3 = result.current;

        // The root object and players reference should have changed again.
        expect(stateAfterAddingPlayer1).not.toBe(stateAfterAddingPlayer3);
        expect(stateAfterAddingPlayer1.players).not.toBe(stateAfterAddingPlayer3.players);

        // The existing player references should be the same.
        expect(stateAfterAddingPlayer2.players["p1"]).toBe(stateAfterAddingPlayer3.players["p1"]);
        expect(stateAfterAddingPlayer2.players["p2"]).toBe(stateAfterAddingPlayer3.players["p2"]);
    });

    test('removing players doesn\'t reallocate existing players', () => {
        // Remove the second and third players from the state.
        act(() => {
            updateState((state) => {
                state.players.delete("p2");
                state.players.delete("p3");
            });
        });

        const stateAfterRemovingPlayers = result.current;

        // The root object and players reference should have changed.
        expect(stateAfterAddingPlayer1).not.toBe(stateAfterRemovingPlayers);
        expect(stateAfterAddingPlayer1.players).not.toBe(stateAfterRemovingPlayers.players);

        // The existing player reference should be the same.
        expect(stateAfterAddingPlayer1.players["p1"]).toBe(stateAfterRemovingPlayers.players["p1"]);
    });
});

describe('updating player positions', () => {
    const { clientState, updateState, getStateCallbacks } = simulateState(() => new MyRoomState());
    
    const { result } = renderHook(() => useRoomState(clientState, getStateCallbacks));

    // Put two players into the state.
    act(() => {
        updateState((state) => {
            state.players.set("p1", new Player().assign({ name: "Player 1" }));
            state.players.set("p2", new Player().assign({ name: "Player 2" }));
        });
    });

    test('updating p1 position reallocates p1 and position', () => {
        const stateBeforeAdjusting = result.current;

        act(() => {
            updateState((state) => {
                state.players.get("p1")!.position.x = 10;
            });
        });

        const stateAfterAdjusting = result.current;

        // The root object, players, p1 and position references should have changed.
        expect(stateBeforeAdjusting).not.toBe(stateAfterAdjusting);
        expect(stateBeforeAdjusting.players).not.toBe(stateAfterAdjusting.players);
        expect(stateBeforeAdjusting.players["p1"]).not.toBe(stateAfterAdjusting.players["p1"]);
        expect(stateBeforeAdjusting.players["p1"].position).not.toBe(stateAfterAdjusting.players["p1"].position);

        // The p1 inventory reference should be the same.
        expect(stateBeforeAdjusting.players["p1"].inventory).toBe(stateAfterAdjusting.players["p1"].inventory);
    });

    test('updating p2 position reallocates p2 and position', () => {
        const stateBeforeAdjusting = result.current;

        act(() => {
            updateState((state) => {
                state.players.get("p2")!.position.x = 10;
            });
        });

        const stateAfterAdjusting = result.current;

        // The root object, players, p1 and position references should have changed.
        expect(stateBeforeAdjusting).not.toBe(stateAfterAdjusting);
        expect(stateBeforeAdjusting.players).not.toBe(stateAfterAdjusting.players);
        expect(stateBeforeAdjusting.players["p2"]).not.toBe(stateAfterAdjusting.players["p2"]);
        expect(stateBeforeAdjusting.players["p2"].position).not.toBe(stateAfterAdjusting.players["p2"].position);

        // The p2 inventory reference should be the same.
        expect(stateBeforeAdjusting.players["p2"].inventory).toBe(stateAfterAdjusting.players["p2"].inventory);
    });
    
    test('updating p1 position does not reallocate p2', () => {
        const stateBeforeAdjusting = result.current;

        act(() => {
            updateState((state) => {
                state.players.get("p1")!.position.x = 10;
            });
        });

        const stateAfterAdjusting = result.current;

        // The p2 reference should not have changed.
        expect(stateBeforeAdjusting.players["p2"]).toBe(stateAfterAdjusting.players["p2"]);
        expect(stateBeforeAdjusting.players["p2"].position).toBe(stateAfterAdjusting.players["p2"].position);
    });

    test('updating p2 position does not reallocate p1', () => {
        const stateBeforeAdjusting = result.current;

        act(() => {
            updateState((state) => {
                state.players.get("p2")!.position.x = 10;
            });
        });

        const stateAfterAdjusting = result.current;

        // The p1 reference should not have changed.
        expect(stateBeforeAdjusting.players["p1"]).toBe(stateAfterAdjusting.players["p1"]);
        expect(stateBeforeAdjusting.players["p1"].position).toBe(stateAfterAdjusting.players["p1"].position);
    });
});