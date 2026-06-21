import "reflect-metadata";
import "./polyfill";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// No StrictMode here on purpose: the double-invoked effects make the
// unmount/remount timeline harder to follow in this demo.
createRoot(document.getElementById("root")!).render(<App />);
