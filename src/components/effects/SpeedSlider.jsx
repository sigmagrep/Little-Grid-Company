import React from "react";
import { clamp } from "../../lib/color.js";

// Geometric speed slider shared by effects, blink and snake.
// `frames` = frames-per-step (lower is faster); `setFrames(n)` commits a new value.
export default function SpeedSlider({ frames, setFrames, fmax, fmin }) {
  const lo = fmin || 1;
  const f = clamp(frames || lo, lo, fmax);
  const STEPS = 1000;
  // geometric: period = fmax * (lo/fmax)^sPos, sPos 0=slow(fmax) .. 1=fast(lo)
  const sPos = (Math.log(f) - Math.log(fmax)) / (Math.log(lo) - Math.log(fmax) || 1);
  const pos = Math.round(sPos * STEPS);
  const snap = (v) => (v >= 1 ? Math.round(v) : Math.round(v * 2) / 2); // halves below 1
  const fromPos = (p) => clamp(snap(fmax * Math.pow(lo / fmax, p / STEPS)), lo, fmax);
  return (
    <div className="flex items-center gap-2 text-indigo-700">
      <span className="uppercase tracking-wide">Speed</span>
      <span className="text-indigo-400">slow</span>
      <input type="range" min="0" max={STEPS} value={pos} onChange={(e) => setFrames(fromPos(parseInt(e.target.value, 10) || 0))} className="flex-1" style={{ accentColor: "#4f46e5" }} />
      <span className="text-indigo-400">fast</span>
      <input type="number" min={lo} max={fmax} step={lo < 1 ? 0.5 : 1} value={f} onChange={(e) => setFrames(clamp(parseFloat(e.target.value) || lo, lo, fmax))}
        title="frames per step (lower = faster; below 1 advances multiple cells per frame)" className="w-12 px-1 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
    </div>
  );
}
