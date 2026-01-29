import {createRoot} from "react-dom/client";

import {App} from "./App";
import "./index.scss";

const originalWarn = console.warn;
console.warn = (...args: any[]) => {
    const message = args[0];
    if (typeof message === 'string' && message.includes('PixiJS Deprecation Warning')) {
        return;
    }
    originalWarn.apply(console, args);
};

createRoot(document.getElementById("root")).render(<App />);
