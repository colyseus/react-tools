/* eslint-disable @typescript-eslint/no-explicit-any */
import { Schema, Decoder, DataChange } from "@colyseus/schema";

/**
 * Subscription state for a single room, shared across all hook instances
 * consuming the same room state.
 */
interface StateSubscription {
    /** Set of callbacks to invoke when state changes */
    listeners: Set<() => void>;
    /** Cached snapshot results from the previous render, keyed by refId */
    previousResultsByRefId: Map<number, any>;
    /** Original triggerChanges function from the decoder */
    originalTrigger?: (changes: DataChange[]) => void;
}

/** WeakMap to store subscriptions per room state instance */
const subscriptionsByState = new WeakMap<Schema, StateSubscription>();

/**
 * Gets or creates a subscription for the given room state.
 * 
 * This function sets up change notification by wrapping the decoder's
 * `triggerChanges` method to notify all subscribed React components.
 * 
 * @param roomState - The Colyseus room state Schema instance
 * @param decoder - The Colyseus decoder associated with the room
 * @returns The subscription object for this room state
 */
export function getOrCreateSubscription(roomState: Schema, decoder: Decoder): StateSubscription {
    let subscription = subscriptionsByState.get(roomState);

    if (subscription) {
        return subscription;
    }

    subscription = {
        listeners: new Set(),
        previousResultsByRefId: new Map(),
    };

    // Wrap the decoder's triggerChanges to notify React subscribers.
    subscription.originalTrigger = decoder.triggerChanges?.bind(decoder);

    decoder.triggerChanges = (changes: DataChange[]) => {
        // Call the original trigger first (for Colyseus callbacks like onChange).
        if (subscription.originalTrigger) {
            subscription.originalTrigger(changes);
        }

        // Notify all React subscribers that state has changed.
        subscription.listeners.forEach((callback) => callback());
    };

    subscriptionsByState.set(roomState, subscription);
    return subscription;
}
