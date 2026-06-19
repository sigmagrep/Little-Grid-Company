import React from "react";
import { useStudio } from "../../studio/StudioContext.jsx";
import { clamp } from "../../lib/color.js";
import ColorListEditor from "./ColorListEditor.jsx";
import AreaRow from "./AreaRow.jsx";
import SpeedSlider from "./SpeedSlider.jsx";

export default function GlittersPanel({ layer: desc }) {
  const { updateSelectedLayer } = useStudio();
  const set = (fn) => updateSelectedLayer(fn);
  return (
    <div className="text-xs rounded-md bg-indigo-50 border border-indigo-200 p-3 space-y-3">
      <div className="font-semibold text-indigo-800 uppercase tracking-wide">Glitters layer</div>
      <div className="text-indigo-900">Drag a <b>rectangle</b>; cells twinkle with random colors from the list.</div>
      <ColorListEditor colors={desc.colors} set={set} lo={1} />
      <label className="flex items-center gap-2 text-indigo-700"><span className="uppercase tracking-wide">Density</span>
        <input type="range" min="1" max="80" value={desc.density || 12} onChange={(e) => set((s) => ({ ...s, density: clamp(parseInt(e.target.value, 10) || 1, 1, 80) }))} className="flex-1" style={{ accentColor: "#4f46e5" }} />
        <span className="font-mono text-indigo-500 w-8 text-right">{desc.density || 12}</span>
      </label>
      <label className="flex items-center gap-1.5 text-indigo-700"><span className="uppercase tracking-wide">Variations</span>
        <input type="number" min="1" max="32" value={desc.steps} onChange={(e) => set((s) => ({ ...s, steps: clamp(parseInt(e.target.value, 10) || 1, 1, 32) }))} title="distinct random states before the loop repeats"
          className="w-12 px-1 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
      </label>
      <SpeedSlider frames={desc.cycleFrames} setFrames={(f) => set((s) => ({ ...s, cycleFrames: clamp(f, 1, 60) }))} fmax={60} />
      <AreaRow layer={desc} set={set} />
      <div className="text-indigo-500">Loops every Speed × Variations frames.</div>
    </div>
  );
}
