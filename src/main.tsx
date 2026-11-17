import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { installQaHook } from "./qaHook";
installQaHook();
createRoot(document.getElementById("root")!).render(<App />);
