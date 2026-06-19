import React from "react";
import { useStudio } from "../../studio/StudioContext.jsx";
import { clamp } from "../../lib/color.js";
import ColorListEditor from "./ColorListEditor.jsx";
import AreaRow from "./AreaRow.jsx";
import SpeedSlider from "./SpeedSlider.jsx";

export default function ElectronPanel({ layer: desc }) {
  const { updateSelectedLayer } = useStudio();
  const set = (fn) => updateSelectedLayer(fn);
  return (
    <div className="text-xs rounded-md bg-indigo-50 border border-indigo-200 p-3 space-y-3">
      <div className="font-semibold text-indigo-800 uppercase tracking-wide">Electron layer</div>
      <div className="text-indigo-900">Drag a <b>rectangle</b>; dots orbit its center with irregular speed and stay spaced apart.</div>
      <ColorListEditor colors={desc.colors} set={set} lo={1} />
      <label className="flex items-center gap-1.5 text-indigo-700"><span className="uppercase tracking-wide">Count</span>
        <input type="number" min="1" max="12" value={desc.count} onChange={(e) => set((s) => ({ ...s, count: clamp(parseInt(e.target.value, 10) || 1, 1, 12) }))}
          className="w-12 px-1 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
      </label>
      <SpeedSlider frames={desc.cycleFrames} setFrames={(f) => set((s) => ({ ...s, cycleFrames: clamp(f, 1, 120) }))} fmax={120} />
      <AreaRow layer={desc} set={set} />
    </div>
  );
}
