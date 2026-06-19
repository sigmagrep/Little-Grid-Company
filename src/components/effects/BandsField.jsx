import React from "react";
import { clamp } from "../../lib/color.js";

// "Bands" numeric field — how many times the gradient tiles across the area.
export default function BandsField({ layer, set }) {
  return (
    <label className="flex items-center gap-1.5 text-indigo-700">
      <span className="uppercase tracking-wide">Bands</span>
      <input type="number" min="1" max="32" value={layer.bands} onChange={(e) => set((s) => ({ ...s, bands: clamp(parseInt(e.target.value, 10) || 1, 1, 32) }))}
        className="w-12 px-1 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
    </label>
  );
}
