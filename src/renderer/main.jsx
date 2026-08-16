import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/toast";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={200} skipDelayDuration={300}>
      <App />
      <Toaster />
    </TooltipProvider>
  </React.StrictMode>
);
