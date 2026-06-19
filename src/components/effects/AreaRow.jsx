import React from "react";
import { useStudio } from "../../studio/StudioContext.jsx";

// Shows the current effect area and a "Clear area" button.
export default function AreaRow({ layer, set }) {
  const { drawCanvas } = useStudio();
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-indigo-500">{layer.rect ? `area ${Math.abs(layer.rect.c1 - layer.rect.c0) + 1}×${Math.abs(layer.rect.r1 - layer.rect.r0) + 1}` : "no area — drag on the grid"}</span>
      {layer.rect && (<button onClick={() => { set((s) => ({ ...s, rect: null })); drawCanvas(); }} className="ml-auto px-2 py-1 rounded-md border border-neutral-300 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100">Clear area</button>)}
    </div>
  );
}
