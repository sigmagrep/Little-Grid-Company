import React from "react";
import { createRoot } from "react-dom/client";
import PixelArtStudio from "./littlegridcompany.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PixelArtStudio />
  </React.StrictMode>
);
