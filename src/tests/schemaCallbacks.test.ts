import 'reflect-metadata';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { getDecoderStateCallbacks } from '@colyseus/schema';
import { useColyseusState } from '../schema/useColyseusState';
import { simulateState } from './schema/simulateState';
import { Item, MyRoomState, Player, Position } from './schema/MyRoomState';

describe('coexistence with getDecoderStateCallbacks', () => {
    test('callbacks registered BEFORE useColyseusState still fire', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());

        const $ = getDecoderStateCallbacks(decoder);
        const onAdd = vi.fn();
        const onRemove = vi.fn();
        $(clientState).players.onAdd(onAdd);
        $(clientState).players.onRemove(onRemove);

        renderHook(() => useColyseusState(clientState, decoder));

        act(() => {
            updateState((s) => {
                s.players.set("p1", new Player().assign({ name: "P1" }));
                s.players.set("p2", new Player().assign({ name: "P2" }));
            });
        });

        expect(onAdd).toHaveBeenCalledTimes(2);

        act(() => { updateState((s) => { s.players.delete("p1"); }); });
        expect(onRemove).toHaveBeenCalledTimes(1);
    });

    test('callbacks registered AFTER useColyseusState still fire', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());

        renderHook(() => useColyseusState(clientState, decoder));

        const $ = getDecoderStateCallbacks(decoder);
        const onAdd = vi.fn();
        $(clientState).players.onAdd(onAdd);

        act(() => {
            updateState((s) => { s.players.set("p1", new Player().assign({ name: "P1" })); });
        });

        expect(onAdd).toHaveBeenCalledTimes(1);
    });

    test('hook snapshot and callback see the same patch', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());
        const $ = getDecoderStateCallbacks(decoder);

        const seenByCallback: string[] = [];
        $(clientState).players.onAdd((player, key) => {
            seenByCallback.push(`${key}:${player.name}`);
        });

        const { result } = renderHook(() => useColyseusState(clientState, decoder));

        act(() => {
            updateState((s) => {
                s.players.set("p1", new Player().assign({ name: "alice" }));
                s.players.set("p2", new Player().assign({ name: "bob" }));
            });
        });

        expect(seenByCallback.sort()).toEqual(["p1:alice", "p2:bob"]);
        expect(Object.keys(result.current.players).sort()).toEqual(["p1", "p2"]);
        expect(result.current.players.p1.name).toBe("alice");
        expect(result.current.players.p2.name).toBe("bob");
    });

    test('listen() on a property fires alongside hook updates', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());
        const $ = getDecoderStateCallbacks(decoder);

        const onMyString = vi.fn();
        $(clientState).listen("myString", onMyString);

        const { result } = renderHook(() => useColyseusState(clientState, decoder));

        act(() => { updateState((s) => { s.myString = "new"; }); });

        expect(onMyString).toHaveBeenCalledWith("new", "Hello world!");
        expect(result.current.myString).toBe("new");
    });

    test('onChange on a map fires on per-key value change', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());
        const $ = getDecoderStateCallbacks(decoder);

        const onChange = vi.fn();
        $(clientState).players.onChange(onChange);

        renderHook(() => useColyseusState(clientState, decoder));

        act(() => { updateState((s) => { s.players.set("p1", new Player().assign({ name: "P1" })); }); });
        act(() => { updateState((s) => { s.players.get("p1")!.name = "renamed"; }); });

        expect(onChange).toHaveBeenCalled();
    });

    test('detached callback stops firing', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());
        const $ = getDecoderStateCallbacks(decoder);

        const onAdd = vi.fn();
        const detach = $(clientState).players.onAdd(onAdd);

        renderHook(() => useColyseusState(clientState, decoder));

        act(() => { updateState((s) => { s.players.set("p1", new Player().assign({ name: "P1" })); }); });
        expect(onAdd).toHaveBeenCalledTimes(1);

        detach();

        act(() => { updateState((s) => { s.players.set("p2", new Player().assign({ name: "P2" })); }); });
        expect(onAdd).toHaveBeenCalledTimes(1);
    });

    test('nested onAdd inside onAdd fires on inventory push', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());
        const $ = getDecoderStateCallbacks(decoder);

        const inventoryAdd = vi.fn();
        $(clientState).players.onAdd((player) => {
            $(player).inventory.onAdd(inventoryAdd);
        });

        renderHook(() => useColyseusState(clientState, decoder));

        act(() => { updateState((s) => { s.players.set("p1", new Player().assign({ name: "P1" })); }); });
        act(() => {
            updateState((s) => {
                s.players.get("p1")!.inventory.push(new Item("potion", 3));
            });
        });

        expect(inventoryAdd).toHaveBeenCalledTimes(1);
        const [item] = inventoryAdd.mock.calls[0];
        expect(item.type).toBe("potion");
        expect(item.quantity).toBe(3);
    });

    test('child Schema listen() fires after reassignment', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());
        updateState((s) => { s.players.set("p1", new Player().assign({ name: "P1" })); });

        const $ = getDecoderStateCallbacks(decoder);

        const onX = vi.fn();
        // Bind listener onto the current p1.position and confirm it fires after a field update.
        const p1 = clientState.players.get("p1")!;
        $(p1).position.listen("x", onX);

        renderHook(() => useColyseusState(clientState, decoder));

        act(() => { updateState((s) => { s.players.get("p1")!.position.x = 42; }); });

        expect(onX).toHaveBeenCalledWith(42, 0);
    });

    test('callbacks fire without a mounted hook (baseline)', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());
        const $ = getDecoderStateCallbacks(decoder);

        const onAdd = vi.fn();
        $(clientState).players.onAdd(onAdd);

        updateState((s) => { s.players.set("p1", new Player().assign({ name: "P1" })); });
        expect(onAdd).toHaveBeenCalledTimes(1);
    });
});

describe('full-state resync', () => {
    test('second decode carrying full root replaces previous snapshot', () => {
        const { clientState, decoder, updateState } = simulateState(() => new MyRoomState());
        updateState((s) => {
            s.myString = "first";
            s.players.set("p1", new Player().assign({ name: "P1" }));
        });

        const { result } = renderHook(() => useColyseusState(clientState, decoder));
        expect(result.current.myString).toBe("first");

        // Simulate a server-side field update that should be reflected in the next snapshot
        act(() => { updateState((s) => { s.myString = "second"; }); });
        expect(result.current.myString).toBe("second");

        // Simulate replacing a nested Schema (a form of partial resync)
        act(() => {
            updateState((s) => {
                s.players.get("p1")!.position = new Position().assign({ x: 7, y: 8 });
            });
        });
        expect(result.current.players.p1.position).toEqual(expect.objectContaining({ x: 7, y: 8 }));
    });
});
