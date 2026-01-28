import 'reflect-metadata';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, test } from 'vitest'
import { useColyseusState } from '../schema/useColyseusState';
import { simulateState } from './schema/simulateState';
import { Item, MyRoomState, Player } from './schema/MyRoomState';
import { LargeArrayState, Cell } from './schema/LargeArrayState';
import { Encoder } from "@colyseus/schema";

test('reassign field on root object', () => {
    const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());

    const { result } = renderHook(() => useColyseusState(clientState, decoder));

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
    const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());

    const { result } = renderHook(() => useColyseusState(clientState, decoder));

    // Put one player into the state.
    act(() => {
        updateState((state) => {
            state.players.set("p1", new Player().assign({ name: "Player 1" }));
        });
    });

    test('adding second player doesn\'t reallocate first', () => {
        const stateBeforeAdding = result.current;

        // Add a second player into the state.
        act(() => {
            updateState((state) => {
                state.players.set("p2", new Player().assign({ name: "Player 2" }));
            });
        });

        const stateAfterAdding = result.current;

        // The root object and players reference should have changed.
        expect(stateBeforeAdding).not.toBe(stateAfterAdding);
        expect(stateBeforeAdding.players).not.toBe(stateAfterAdding.players);

        // The existing player reference should be the same.
        expect(stateBeforeAdding.players["p1"]).toBe(stateAfterAdding.players["p1"]);
    });

    test('adding third player doesn\'t reallocate first or second', () => {
        const stateBeforeAdding = result.current;

        // Add a third player into the state.
        act(() => {
            updateState((state) => {
                state.players.set("p3", new Player().assign({ name: "Player 3" }));
            });
        });

        const stateAfterAdding = result.current;

        // The root object and players reference should have changed again.
        expect(stateBeforeAdding).not.toBe(stateAfterAdding);
        expect(stateBeforeAdding.players).not.toBe(stateAfterAdding.players);

        // The existing player references should be the same.
        expect(stateBeforeAdding.players["p1"]).toBe(stateAfterAdding.players["p1"]);
        expect(stateBeforeAdding.players["p2"]).toBe(stateAfterAdding.players["p2"]);
    });

    test('removing players doesn\'t reallocate existing players', () => {
        const stateBeforeRemoving = result.current;

        // Remove the second and third players from the state.
        act(() => {
            updateState((state) => {
                state.players.delete("p2");
                state.players.delete("p3");
            });
        });

        const stateAfterRemoving = result.current;

        // The root object and players reference should have changed.
        expect(stateBeforeRemoving).not.toBe(stateAfterRemoving);
        expect(stateBeforeRemoving.players).not.toBe(stateAfterRemoving.players);

        // The existing player reference should be the same.
        expect(stateBeforeRemoving.players["p1"]).toBe(stateAfterRemoving.players["p1"]);
    });
});

describe('updating player positions', () => {
    const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());

    const { result } = renderHook(() => useColyseusState(clientState, decoder));

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

describe('updating inventory items', () => {
    const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());

    const { result } = renderHook(() => useColyseusState(clientState, decoder));

    // Put two players into the state.
    act(() => {
        updateState((state) => {
            state.players.set("p1", new Player().assign({ name: "Player 1" }));
            state.players.set("p2", new Player().assign({ name: "Player 2" }));
        });
    });

    test('adding to p1 inventory reallocates p1 and inventory, not position', () => {
        const stateBeforeAdding = result.current;

        act(() => {
            updateState((state) => {
                state.players.get("p1")!.inventory.push(new Item("Some item"));
            });
        });

        const stateAfterAdding = result.current;

        // The root object, players, p1 and inventory references should have changed.
        expect(stateBeforeAdding).not.toBe(stateAfterAdding);
        expect(stateBeforeAdding.players).not.toBe(stateAfterAdding.players);
        expect(stateBeforeAdding.players["p1"]).not.toBe(stateAfterAdding.players["p1"]);
        expect(stateBeforeAdding.players["p1"].inventory).not.toBe(stateAfterAdding.players["p1"].inventory);

        // The p1 position reference should be the same.
        expect(stateBeforeAdding.players["p1"].position).toBe(stateAfterAdding.players["p1"].position);
    });

    test('adding to p1 inventory doesn\'t reallocate p2', () => {
        const stateBeforeAdding = result.current;

        act(() => {
            updateState((state) => {
                state.players.get("p1")!.inventory.push(new Item("Another item"));
            });
        });

        const stateAfterAdding = result.current;

        // The root object, players, p1 and inventory references should have changed.
        expect(stateBeforeAdding).not.toBe(stateAfterAdding);
        expect(stateBeforeAdding.players).not.toBe(stateAfterAdding.players);
        expect(stateBeforeAdding.players["p2"]).toBe(stateAfterAdding.players["p2"]);
        expect(stateBeforeAdding.players["p2"].inventory).toBe(stateAfterAdding.players["p2"].inventory);
        expect(stateBeforeAdding.players["p2"].position).toBe(stateAfterAdding.players["p2"].position);
    });

    test('updating inventory item quantity reallocates item', () => {
        const stateBeforeUpdating = result.current;
        const itemCountBefore = stateBeforeUpdating.players["p1"].inventory.length;

        act(() => {
            updateState((state) => {
                state.players.get("p1")!.inventory.at(0)!.quantity = 5;
            });
        });

        const stateAfterUpdating = result.current;

        // The root object, players, p1, inventory, and item references should have changed.
        expect(stateBeforeUpdating).not.toBe(stateAfterUpdating);
        expect(stateBeforeUpdating.players).not.toBe(stateAfterUpdating.players);
        expect(stateBeforeUpdating.players["p1"]).not.toBe(stateAfterUpdating.players["p1"]);
        expect(stateBeforeUpdating.players["p1"].inventory).not.toBe(stateAfterUpdating.players["p1"].inventory);
        expect(stateBeforeUpdating.players["p1"].inventory[0]).not.toBe(stateAfterUpdating.players["p1"].inventory[0]);

        // The quantity should have changed.
        expect(stateAfterUpdating.players["p1"].inventory[0].quantity).toBe(5);

        // The inventory length should be the same.
        expect(stateAfterUpdating.players["p1"].inventory.length).toBe(itemCountBefore);

        // The p1 position reference should be the same.
        expect(stateBeforeUpdating.players["p1"].position).toBe(stateAfterUpdating.players["p1"].position);

        // The p2 reference should be the same.
        expect(stateBeforeUpdating.players["p2"]).toBe(stateAfterUpdating.players["p2"]);
    });

    test('updating one inventory item doesn\'t reallocate other items', () => {
        // First add another item to p1's inventory
        act(() => {
            updateState((state) => {
                state.players.get("p1")!.inventory.push(new Item("Third item"));
            });
        });

        const stateBeforeUpdating = result.current;

        act(() => {
            updateState((state) => {
                state.players.get("p1")!.inventory.at(0)!.quantity = 10;
            });
        });

        const stateAfterUpdating = result.current;

        // The first item should have changed.
        expect(stateBeforeUpdating.players["p1"].inventory[0]).not.toBe(stateAfterUpdating.players["p1"].inventory[0]);

        // Other items should be the same reference.
        expect(stateBeforeUpdating.players["p1"].inventory[1]).toBe(stateAfterUpdating.players["p1"].inventory[1]);
        expect(stateBeforeUpdating.players["p1"].inventory[2]).toBe(stateAfterUpdating.players["p1"].inventory[2]);
    });

    test('removing last inventory item with pop() reallocates inventory', () => {
        const stateBeforeRemoving = result.current;
        const itemCountBefore = stateBeforeRemoving.players["p1"].inventory.length;

        act(() => {
            updateState((state) => {
                state.players.get("p1")!.inventory.pop();
            });
        });

        const stateAfterRemoving = result.current;

        // The root object, players, p1, and inventory references should have changed.
        expect(stateBeforeRemoving).not.toBe(stateAfterRemoving);
        expect(stateBeforeRemoving.players).not.toBe(stateAfterRemoving.players);
        expect(stateBeforeRemoving.players["p1"]).not.toBe(stateAfterRemoving.players["p1"]);
        expect(stateBeforeRemoving.players["p1"].inventory).not.toBe(stateAfterRemoving.players["p1"].inventory);

        // The inventory length should have decreased.
        expect(stateAfterRemoving.players["p1"].inventory.length).toBe(itemCountBefore - 1);

        // The p1 position reference should be the same.
        expect(stateBeforeRemoving.players["p1"].position).toBe(stateAfterRemoving.players["p1"].position);

        // The p2 reference should be the same.
        expect(stateBeforeRemoving.players["p2"]).toBe(stateAfterRemoving.players["p2"]);
    });

    test('removing last inventory item with pop() doesn\'t reallocate remaining items', () => {
        // First add items back to have multiple
        act(() => {
            updateState((state) => {
                state.players.get("p1")!.inventory.push(new Item("Item A"));
                state.players.get("p1")!.inventory.push(new Item("Item B"));
            });
        });

        const stateBeforeRemoving = result.current;
        const firstItemBefore = stateBeforeRemoving.players["p1"].inventory[0];

        act(() => {
            updateState((state) => {
                state.players.get("p1")!.inventory.pop();
            });
        });

        const stateAfterRemoving = result.current;

        // The first item should be the same reference (only last item was removed).
        expect(stateAfterRemoving.players["p1"].inventory[0]).toBe(firstItemBefore);
    });
});

describe('array index stability after removal', () => {
    const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());

    const { result } = renderHook(() => useColyseusState(clientState, decoder));

    // Set up a player with multiple inventory items.
    act(() => {
        updateState((state) => {
            state.players.set("p1", new Player().assign({ name: "Player 1" }));
            state.players.get("p1")!.inventory.push(new Item("Item 0", 10));
            state.players.get("p1")!.inventory.push(new Item("Item 1", 20));
            state.players.get("p1")!.inventory.push(new Item("Item 2", 30));
        });
    });

    test('items have correct initial indexes', () => {
        const state = result.current;
        expect(state.players["p1"].inventory.length).toBe(3);
        expect(state.players["p1"].inventory[0].type).toBe("Item 0");
        expect(state.players["p1"].inventory[1].type).toBe("Item 1");
        expect(state.players["p1"].inventory[2].type).toBe("Item 2");
    });

    test('removing first item shifts remaining items to correct indexes', () => {
        act(() => {
            updateState((state) => {
                state.players.get("p1")!.inventory.splice(0, 1);
            });
        });

        const state = result.current;

        // Array should now have 2 items.
        expect(state.players["p1"].inventory.length).toBe(2);

        // Items should have shifted: "Item 1" is now at index 0, "Item 2" at index 1.
        expect(state.players["p1"].inventory[0].type).toBe("Item 1");
        expect(state.players["p1"].inventory[0].quantity).toBe(20);
        expect(state.players["p1"].inventory[1].type).toBe("Item 2");
        expect(state.players["p1"].inventory[1].quantity).toBe(30);
    });

    test('updating shifted item uses correct index path', () => {
        // At this point "Item 1" is at index 0 after the previous removal.
        const stateBeforeUpdate = result.current;

        act(() => {
            updateState((state) => {
                // Update the item that was originally "Item 1", now at index 0.
                state.players.get("p1")!.inventory.at(0)!.quantity = 999;
            });
        });

        const stateAfterUpdate = result.current;

        // The item at index 0 should have the new quantity.
        expect(stateAfterUpdate.players["p1"].inventory[0].quantity).toBe(999);
        expect(stateAfterUpdate.players["p1"].inventory[0].type).toBe("Item 1");

        // The item reference should have changed (it was updated).
        expect(stateBeforeUpdate.players["p1"].inventory[0]).not.toBe(stateAfterUpdate.players["p1"].inventory[0]);

        // The other item should be unchanged.
        expect(stateBeforeUpdate.players["p1"].inventory[1]).toBe(stateAfterUpdate.players["p1"].inventory[1]);
    });

    test('removing middle item shifts only items after it', () => {
        // Reset by adding items back.
        act(() => {
            updateState((state) => {
                // Clear and re-add items.
                while (state.players.get("p1")!.inventory.length > 0) {
                    state.players.get("p1")!.inventory.splice(0, 1);
                }
                state.players.get("p1")!.inventory.push(new Item("A", 1));
                state.players.get("p1")!.inventory.push(new Item("B", 2));
                state.players.get("p1")!.inventory.push(new Item("C", 3));
            });
        });

        const stateBeforeRemoval = result.current;
        const itemA = stateBeforeRemoval.players["p1"].inventory[0];
        const itemC = stateBeforeRemoval.players["p1"].inventory[2];

        // Remove the middle item (B).
        act(() => {
            updateState((state) => {
                state.players.get("p1")!.inventory.splice(1, 1);
            });
        });

        const stateAfterRemoval = result.current;

        // Array should now have 2 items.
        expect(stateAfterRemoval.players["p1"].inventory.length).toBe(2);

        // "A" should still be at index 0, same reference.
        expect(stateAfterRemoval.players["p1"].inventory[0].type).toBe("A");
        expect(stateAfterRemoval.players["p1"].inventory[0]).toBe(itemA);

        // "C" should now be at index 1, same reference (just shifted).
        expect(stateAfterRemoval.players["p1"].inventory[1].type).toBe("C");
        expect(stateAfterRemoval.players["p1"].inventory[1]).toBe(itemC);
    });

    test('updating item after middle removal uses correct index', () => {
        // At this point we have ["A", "C"] after previous test.
        const stateBeforeUpdate = result.current;

        // Update "C" which is now at index 1.
        act(() => {
            updateState((state) => {
                state.players.get("p1")!.inventory.at(1)!.quantity = 333;
            });
        });

        const stateAfterUpdate = result.current;

        // The item at index 1 should have the new quantity.
        expect(stateAfterUpdate.players["p1"].inventory[1].quantity).toBe(333);
        expect(stateAfterUpdate.players["p1"].inventory[1].type).toBe("C");

        // The item at index 0 should be unchanged.
        expect(stateBeforeUpdate.players["p1"].inventory[0]).toBe(stateAfterUpdate.players["p1"].inventory[0]);
    });
});

describe('multiple simultaneous changes', () => {
    const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());

    const { result } = renderHook(() => useColyseusState(clientState, decoder));

    // Put two players into the state.
    act(() => {
        updateState((state) => {
            state.players.set("p1", new Player().assign({ name: "Player 1" }));
            state.players.set("p2", new Player().assign({ name: "Player 2" }));
        });
    });

    test('updating both players in single update reallocates both', () => {
        const stateBeforeUpdating = result.current;

        act(() => {
            updateState((state) => {
                state.players.get("p1")!.position.x = 100;
                state.players.get("p2")!.position.y = 200;
            });
        });

        const stateAfterUpdating = result.current;

        // Both players and their positions should have changed.
        expect(stateBeforeUpdating.players["p1"]).not.toBe(stateAfterUpdating.players["p1"]);
        expect(stateBeforeUpdating.players["p1"].position).not.toBe(stateAfterUpdating.players["p1"].position);
        expect(stateBeforeUpdating.players["p2"]).not.toBe(stateAfterUpdating.players["p2"]);
        expect(stateBeforeUpdating.players["p2"].position).not.toBe(stateAfterUpdating.players["p2"].position);

        // Values should be correct.
        expect(stateAfterUpdating.players["p1"].position.x).toBe(100);
        expect(stateAfterUpdating.players["p2"].position.y).toBe(200);

        // Inventories should be unchanged.
        expect(stateBeforeUpdating.players["p1"].inventory).toBe(stateAfterUpdating.players["p1"].inventory);
        expect(stateBeforeUpdating.players["p2"].inventory).toBe(stateAfterUpdating.players["p2"].inventory);
    });

    test('updating position and adding inventory item in single update', () => {
        const stateBeforeUpdating = result.current;

        act(() => {
            updateState((state) => {
                state.players.get("p1")!.position.x = 150;
                state.players.get("p1")!.inventory.push(new Item("Sword"));
            });
        });

        const stateAfterUpdating = result.current;

        // The player, position, and inventory should all have changed.
        expect(stateBeforeUpdating.players["p1"]).not.toBe(stateAfterUpdating.players["p1"]);
        expect(stateBeforeUpdating.players["p1"].position).not.toBe(stateAfterUpdating.players["p1"].position);
        expect(stateBeforeUpdating.players["p1"].inventory).not.toBe(stateAfterUpdating.players["p1"].inventory);

        // Values should be correct.
        expect(stateAfterUpdating.players["p1"].position.x).toBe(150);
        expect(stateAfterUpdating.players["p1"].inventory.length).toBeGreaterThan(0);

        // The p2 reference should be the same.
        expect(stateBeforeUpdating.players["p2"]).toBe(stateAfterUpdating.players["p2"]);
    });

    test('updating root field and player simultaneously', () => {
        const stateBeforeUpdating = result.current;

        act(() => {
            updateState((state) => {
                state.myString = "Updated string";
                state.players.get("p1")!.name = "New Name";
            });
        });

        const stateAfterUpdating = result.current;

        // Root should have changed.
        expect(stateBeforeUpdating).not.toBe(stateAfterUpdating);
        expect(stateAfterUpdating.myString).toBe("Updated string");

        // Player should have changed.
        expect(stateBeforeUpdating.players["p1"]).not.toBe(stateAfterUpdating.players["p1"]);
        expect(stateAfterUpdating.players["p1"].name).toBe("New Name");

        // Position and inventory should be unchanged.
        expect(stateBeforeUpdating.players["p1"].position).toBe(stateAfterUpdating.players["p1"].position);
        expect(stateBeforeUpdating.players["p1"].inventory).toBe(stateAfterUpdating.players["p1"].inventory);
    });
});

describe('performance with large arrays', () => {
    Encoder.BUFFER_SIZE = 64 * 1024; // 64KB buffer to handle large states
    test('demonstrates performance issue with 2500 item array', () => {
        const { clientState, decoder, updateState } = simulateState(() => {
            const state = new LargeArrayState();

            // Create a 50x50 board
            for (let i = 0; i < 2500; i++) {
                const cell = new Cell();
                cell.value = 0;
                cell.revealed = false;
                state.cells.push(cell);
            }

            return state;
        });

        const { result } = renderHook(() => useColyseusState(clientState, decoder));

        expect(result.current.cells.length).toBe(2500);

        // Measure: Update ONLY ONE cell
        const updateOneStart = performance.now();

        act(() => {
            updateState((state) => {
                state.cells[1234].revealed = true; // Change just ONE cell
            });
        });

        const updateOneEnd = performance.now();
        const updateOneDuration = updateOneEnd - updateOneStart;

        console.log(`--- Updating one cell in 2500 item array ---`);
        console.log(`Time: ${updateOneDuration.toFixed(2)}ms`);

        const rerenderStart = performance.now();

        act(() => {
            updateState((state) => {
                state.counter++; // Change unrelated field
            });
        });

        const rerenderEnd = performance.now();
        const rerenderDuration = rerenderEnd - rerenderStart;

        console.log(`--- Simulating re-render with unrelated state change ---`);
        console.log(`Time: ${rerenderDuration.toFixed(2)}ms`);
        //Note: This still triggers full array iteration!

        // Verify the change worked
        expect(result.current.cells[1234].revealed).toBe(true);
        expect(result.current.counter).toBe(1);

        // The problem: both updates take similar time because
        // createSnapshot iterates the entire 2500 item array
    });
});
