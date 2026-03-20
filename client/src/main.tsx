// This is the very first file React reads.
// It finds the <div id="root"> in index.html
// and renders our whole App inside it.
// You never need to change this file.

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);