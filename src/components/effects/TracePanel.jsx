import React from "react";
import { useStudio } from "../../studio/StudioContext.jsx";
import { clamp } from "../../lib/color.js";
import ColorListEditor from "./ColorListEditor.jsx";
import AreaRow from "./AreaRow.jsx";
import SpeedSlider from "./SpeedSlider.jsx";
import DirectionGrid from "./DirectionGrid.jsx";

export default function TracePanel({ layer: desc }) {
  const { updateSelectedLayer } = useStudio();
  const set = (fn) => updateSelectedLayer(fn);
  const setDir = (dir) => set((s) => ({ ...s, dir }));
  const pct = (v, d) => Math.round((v == null ? d : v) * 100);
  return (
    <div className="text-xs rounded-md bg-indigo-50 border border-indigo-200 p-3 space-y-3">
      <div className="font-semibold text-indigo-800 uppercase tracking-wide">Trace layer</div>
      <div className="text-indigo-900">Drag a <b>rectangle</b>; particles stream and leave fading trails. By default each one walks the gradient on its own phase; turn on <b>Fixed gradient in space</b> to anchor color to position — like windows onto a gradient behind the veil.</div>
      <ColorListEditor colors={desc.colors} set={set} lo={1} />
      <div><div className="text-indigo-700 uppercase tracking-wide mb-1">Shape</div>
        <div className="inline-flex rounded-md overflow-hidden border border-indigo-300">
          <button onClick={() => set((s) => ({ ...s, shape: "rect", dir: (s.dir === "out" || s.dir === "in") ? "E" : s.dir }))}
            className={"px-3 py-1 text-xs font-medium " + (desc.shape !== "circle" ? "bg-indigo-600 text-white" : "bg-white text-indigo-700 hover:bg-indigo-100")}>Rectangle</button>
          <button onClick={() => set((s) => ({ ...s, shape: "circle", dir: (s.dir === "out" || s.dir === "in") ? s.dir : "out" }))}
            className={"px-3 py-1 text-xs font-medium border-l border-indigo-300 " + (desc.shape === "circle" ? "bg-indigo-600 text-white" : "bg-white text-indigo-700 hover:bg-indigo-100")}>Circle</button>
        </div>
      </div>
      {desc.shape === "circle" ? (
        <div><div className="text-indigo-700 uppercase tracking-wide mb-1">Direction</div>
          <div className="inline-flex rounded-md overflow-hidden border border-indigo-300">
            <button onClick={() => setDir("out")} className={"px-3 py-1 text-xs font-medium flex items-center gap-1 " + (desc.dir !== "in" ? "bg-indigo-600 text-white" : "bg-white text-indigo-700 hover:bg-indigo-100")}>⤴ Outwards</button>
            <button onClick={() => setDir("in")} className={"px-3 py-1 text-xs font-medium border-l border-indigo-300 flex items-center gap-1 " + (desc.dir === "in" ? "bg-indigo-600 text-white" : "bg-white text-indigo-700 hover:bg-indigo-100")}>⤵ Inwards</button>
          </div>
        </div>
      ) : (
        <div><div className="text-indigo-700 uppercase tracking-wide mb-1">Direction</div>
          <DirectionGrid value={desc.dir} onChange={setDir} />
        </div>
      )}
      <label className="flex items-center gap-2 text-indigo-700"><span className="uppercase tracking-wide">Density</span>
        <input type="range" min="1" max="80" value={desc.density || 32} onChange={(e) => set((s) => ({ ...s, density: clamp(parseInt(e.target.value, 10) || 1, 1, 80) }))} className="flex-1" style={{ accentColor: "#4f46e5" }} />
        <span className="font-mono text-indigo-500 w-8 text-right">{desc.density || 32}</span>
      </label>
      <label className="flex items-center gap-2 text-indigo-700"><span className="uppercase tracking-wide">Trail</span>
        <input type="range" min="1" max="24" value={desc.trailLen || 5} onChange={(e) => set((s) => ({ ...s, trailLen: clamp(parseInt(e.target.value, 10) || 1, 1, 24) }))} className="flex-1" style={{ accentColor: "#4f46e5" }} />
        <span className="font-mono text-indigo-500 w-8 text-right">{desc.trailLen || 5}</span>
      </label>
      <label className="flex items-center gap-2 text-indigo-700"><span className="uppercase tracking-wide">Fade</span>
        <input type="range" min="0" max="100" value={pct(desc.trailFade, 0.85)} onChange={(e) => set((s) => ({ ...s, trailFade: (parseInt(e.target.value, 10) || 0) / 100 }))} className="flex-1" style={{ accentColor: "#4f46e5" }} title="how strongly the tail fades to transparent" />
        <span className="font-mono text-indigo-500 w-8 text-right">{pct(desc.trailFade, 0.85)}</span>
      </label>
      <label className="flex items-center gap-2 text-indigo-700 cursor-pointer">
        <input type="checkbox" checked={!!desc.horizon} onChange={(e) => set((s) => ({ ...s, horizon: e.target.checked }))} style={{ accentColor: "#4f46e5" }} />
        <span className="uppercase tracking-wide">Horizon</span>
        <span className="text-indigo-400">{desc.horizon ? "slows + piles up at the far edge" : "even flow"}</span>
      </label>
      {desc.horizon && (
        <label className="flex items-center gap-2 text-indigo-700"><span className="uppercase tracking-wide">Pile-up</span>
          <input type="range" min="10" max="60" value={Math.round((desc.horizonPow == null ? 2.4 : desc.horizonPow) * 10)} onChange={(e) => set((s) => ({ ...s, horizonPow: (parseInt(e.target.value, 10) || 10) / 10 }))} className="flex-1" style={{ accentColor: "#4f46e5" }} title="how hard particles slow & stack near the far edge (the direction sets where the horizon is)" />
          <span className="font-mono text-indigo-500 w-8 text-right">{(desc.horizonPow == null ? 2.4 : desc.horizonPow).toFixed(1)}</span>
        </label>
      )}
      <label className="flex items-center gap-2 text-indigo-700 cursor-pointer">
        <input type="checkbox" checked={!!desc.spaceGrad} onChange={(e) => set((s) => ({ ...s, spaceGrad: e.target.checked }))} style={{ accentColor: "#4f46e5" }} />
        <span className="uppercase tracking-wide">Fixed gradient in space</span>
        <span className="text-indigo-400">{desc.spaceGrad ? "color anchored to position" : "color follows each particle"}</span>
      </label>
      {desc.spaceGrad ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-indigo-700"><span className="uppercase tracking-wide">Bands</span>
              <input type="number" min="1" max="32" value={desc.bands || 1} onChange={(e) => set((s) => ({ ...s, bands: clamp(parseInt(e.target.value, 10) || 1, 1, 32) }))} title="gradient cycles across the area (1 = a single seam)"
                className="w-12 px-1 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
            </label>
            <label className="flex items-center gap-1.5 text-indigo-700"><span className="uppercase tracking-wide">Drift / loop</span>
              <input type="number" min="0" max="12" value={desc.drift || 0} onChange={(e) => set((s) => ({ ...s, drift: clamp(parseInt(e.target.value, 10) || 0, 0, 12) }))} title="0 = static. higher slowly scrolls the whole gradient along the flow (kept seamless)"
                className="w-12 px-1 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-indigo-700"><span className="uppercase tracking-wide">Variation</span>
            <input type="range" min="0" max="200" value={pct(desc.variation, 0.15)} onChange={(e) => set((s) => ({ ...s, variation: (parseInt(e.target.value, 10) || 0) / 100 }))} className="flex-1" style={{ accentColor: "#4f46e5" }} title="how far each particle reads the gradient early/late — 0 = clean bands, small = close-but-irregular" />
            <span className="font-mono text-indigo-500 w-8 text-right">{pct(desc.variation, 0.15)}</span>
          </label>
          <label className="flex items-center gap-2 text-indigo-700"><span className="uppercase tracking-wide">Randomize</span>
            <input type="range" min="0" max="100" value={pct(desc.randomize, 0)} onChange={(e) => set((s) => ({ ...s, randomize: (parseInt(e.target.value, 10) || 0) / 100 }))} className="flex-1" style={{ accentColor: "#4f46e5" }} title="% of particles given a shuffled palette color (same colors, different order)" />
            <span className="font-mono text-indigo-500 w-8 text-right">{pct(desc.randomize, 0)}</span>
          </label>
        </>
      ) : (
        <>
          <label className="flex items-center gap-2 text-indigo-700"><span className="uppercase tracking-wide">Color spread</span>
            <input type="range" min="0" max="100" value={pct(desc.spread, 1)} onChange={(e) => set((s) => ({ ...s, spread: (parseInt(e.target.value, 10) || 0) / 100 }))} className="flex-1" style={{ accentColor: "#4f46e5" }} title="0 = every particle in lockstep · 100 = fully staggered phases" />
            <span className="font-mono text-indigo-500 w-8 text-right">{pct(desc.spread, 1)}</span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-indigo-700"><span className="uppercase tracking-wide">Color cycles / loop</span>
              <input type="number" min="0" max="12" value={desc.colorSpeed == null ? 1 : desc.colorSpeed} onChange={(e) => set((s) => ({ ...s, colorSpeed: clamp(parseInt(e.target.value, 10) || 0, 0, 12) }))} title="how many times each particle walks the whole gradient per loop (integer keeps it seamless)"
                className="w-12 px-1 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
            </label>
            <label className="flex items-center gap-2 text-indigo-700 cursor-pointer">
              <input type="checkbox" checked={!!desc.trailGrad} onChange={(e) => set((s) => ({ ...s, trailGrad: e.target.checked }))} style={{ accentColor: "#4f46e5" }} />
              <span className="uppercase tracking-wide">Gradient along trail</span>
            </label>
          </div>
        </>
      )}
      <SpeedSlider frames={desc.cycleFrames} setFrames={(f) => set((s) => ({ ...s, cycleFrames: clamp(f, 1, 120) }))} fmax={120} />
      <AreaRow layer={desc} set={set} />
      <div className="text-indigo-500">Trails fade by transparency — put a black <b>Artwork</b> layer beneath for the crispest read. Press <b>Play</b> to preview.</div>
    </div>
  );
}
