import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'demo-shared': path.resolve(__dirname, '../demo-shared'),
    },

    // This is needed to prevent multiple versions of @colyseus/schema from being included in the bundle, which can cause issues with state synchronization.
    // Specifically when using instanceof to check if an object is an ArraySchema, MapSchema, or Schema, it can fail if there are multiple versions of @colyseus/schema in the bundle.
    // That happens for this project because it has @colyseus/schema as a dependency, but also imports the useRoomState hook from the root project, and that has its own dependency on (a separate instance of) @colyseus/schema.
    dedupe: ['@colyseus/schema'],
  },
})
