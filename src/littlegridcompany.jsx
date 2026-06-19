import React from "react";
import { StudioProvider } from "./studio/StudioContext.jsx";
import StudioLayout from "./components/StudioLayout.jsx";

export default function PixelArtStudio() {
  return (
    <StudioProvider>
      <StudioLayout />
    </StudioProvider>
  );
}
