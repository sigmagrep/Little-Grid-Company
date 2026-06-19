import React from "react";
import { clamp } from "../../lib/color.js";

// Particles on/off + density, shared by the gradient effects.
export default function ParticleControls({ layer, set }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-indigo-700 cursor-pointer">
        <input type="checkbox" checked={!!layer.particles} onChange={(e) => set((s) => ({ ...s, particles: e.target.checked }))} style={{ accentColor: "#4f46e5" }} />
        <span className="uppercase tracking-wide">Particles</span>
        <span className="text-indigo-400">{layer.particles ? "scattered dots" : "smooth fill"}</span>
      </label>
      {layer.particles && (
        <label className="flex items-center gap-2 text-indigo-700">
          <span className="uppercase tracking-wide">Density</span>
          <input type="range" min="1" max="60" value={layer.density || 12} onChange={(e) => set((s) => ({ ...s, density: clamp(parseInt(e.target.value, 10) || 1, 1, 60) }))} className="flex-1" style={{ accentColor: "#4f46e5" }} />
          <span className="font-mono text-indigo-500 w-8 text-right">{layer.density || 12}</span>
        </label>
      )}
    </div>
  );
}
