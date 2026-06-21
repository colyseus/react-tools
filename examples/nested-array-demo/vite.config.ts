import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../..");

// Self-contained demo: no extra install — it resolves react, @colyseus/schema,
// and the library source from the repo's root node_modules / src.
export default defineConfig({
  root: dir,
  server: {
    open: true,
    // allow importing the library source (../../src) and root node_modules
    fs: { allow: [repoRoot] },
  },
  resolve: {
    // a single @colyseus/schema instance is required for instanceof checks
    dedupe: ["@colyseus/schema", "react", "react-dom"],
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
    // @colyseus/schema uses legacy (experimental) decorators
    tsconfigRaw: {
      compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      tsconfigRaw: {
        compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false },
      },
    },
  },
});
