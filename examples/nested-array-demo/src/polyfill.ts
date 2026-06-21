import { Buffer } from "buffer";

// @colyseus/schema reaches for Buffer in some code paths; provide it in the browser.
// @ts-ignore
globalThis.Buffer = globalThis.Buffer ?? Buffer;
