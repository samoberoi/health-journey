import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global typography — Montserrat
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";


createRoot(document.getElementById("root")!).render(<App />);
