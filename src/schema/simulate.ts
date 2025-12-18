import { Decoder, Encoder, getDecoderStateCallbacks } from "@colyseus/schema"
import { MyRoomState } from "./MyRoomState";

const serverState = new MyRoomState();
const encoder = new Encoder(serverState);

export const clientState = new MyRoomState();
const decoder = new Decoder(clientState);

export const stateCallbacks = getDecoderStateCallbacks(decoder);

// decoder.triggerChanges = function (allChanges) {
// }

export function simulatePatchState(callback: (state: MyRoomState) => void) {
  // simulate server-side mutations
  callback(serverState);

  // encode operations
  const encoded = encoder.encode();

  // decode operations
  decoder.decode(encoded);

  console.log("Decoded state:", clientState.toJSON());
}

// Run an initial encode/decode step, so the client state is initialized ... otherwise, the first call to onAdd on a MapSchema in the state will fail.
simulatePatchState(() => {});
