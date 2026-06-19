import React from "react";
import { useStudio } from "../../studio/StudioContext.jsx";
import { clamp } from "../../lib/color.js";
import ColorListEditor from "./ColorListEditor.jsx";
import BandsField from "./BandsField.jsx";
import ParticleControls from "./ParticleControls.jsx";
import AreaRow from "./AreaRow.jsx";
import SpeedSlider from "./SpeedSlider.jsx";
import DirectionGrid from "./DirectionGrid.jsx";
import { twoBtn } from "./effectStyles.js";

// Shared editor for the gradient effects (sweep, rotate, pulse, radiates, cascade).
export default function GradientPanel({ layer: desc }) {
  const { updateSelectedLayer, LAYER_LABEL } = useStudio();
  const set = (fn) => updateSelectedLayer(fn);
  const setDir = (dir) => set((s) => ({ ...s, dir }));
  const t = desc.type;
  const note = t === "rotate" ? "spins" : t === "pulse" ? "throbs out like a heartbeat" : t === "radiates" ? "streams from the center" : t === "cascade" ? "flows" : "scrolls";
  return (
    <div className="text-xs rounded-md bg-indigo-50 border border-indigo-200 p-3 space-y-3">
      <div className="font-semibold text-indigo-800 uppercase tracking-wide">{LAYER_LABEL[t]} layer</div>
      <div className="text-indigo-900">Drag a <b>rectangle</b> on the grid to set the area. The effect {note} and loops.</div>
      <ColorListEditor colors={desc.colors} set={set} lo={2} />
      {t === "rotate" && (
        <div><div className="text-indigo-700 uppercase tracking-wide mb-1">Spin</div>
          <div className="flex gap-2">{[["CW", "↻ Clockwise"], ["CCW", "↺ Counter"]].map(([dir, lbl]) => (
            <button key={dir} onClick={() => setDir(dir)} className={twoBtn(desc.dir === dir)}>{lbl}</button>))}</div>
        </div>
      )}
      {t === "radiates" && (
        <div><div className="text-indigo-700 uppercase tracking-wide mb-1">Flow</div>
          <div className="flex gap-2">{[["out", "⤢ Outward (sun)"], ["in", "⤡ Inward (black hole)"]].map(([dir, lbl]) => (
            <button key={dir} onClick={() => setDir(dir)} className={twoBtn(desc.dir === dir)}>{lbl}</button>))}</div>
        </div>
      )}
      {(t === "sweep" || t === "cascade") && (
        <div><div className="text-indigo-700 uppercase tracking-wide mb-1">Direction</div>
          <DirectionGrid value={desc.dir} onChange={setDir} />
        </div>
      )}
      {t !== "pulse" && (<div className="flex flex-wrap items-center gap-3"><BandsField layer={desc} set={set} /></div>)}
      <SpeedSlider frames={desc.cycleFrames} setFrames={(f) => set((s) => ({ ...s, cycleFrames: clamp(f, 1, 120) }))} fmax={120} />
      <ParticleControls layer={desc} set={set} />
      <AreaRow layer={desc} set={set} />
      <div className="text-indigo-500">Shows only where layers above it are transparent. Press <b>Play</b> to preview.</div>
    </div>
  );
}
