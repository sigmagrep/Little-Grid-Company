import React from "react";
import { useStudio } from "../studio/StudioContext.jsx";
import SpeedSlider from "./effects/SpeedSlider.jsx";
import GradientPanel from "./effects/GradientPanel.jsx";
import GlittersPanel from "./effects/GlittersPanel.jsx";
import ElectronPanel from "./effects/ElectronPanel.jsx";
import FliesPanel from "./effects/FliesPanel.jsx";
import TracePanel from "./effects/TracePanel.jsx";

export default function LayerEditor() {
  const { sel, togglePick, paintTool, toggleGradient, cssStops, gradStops, shapeKind, setShapeKind, setPaintTool, SHAPE_KINDS, shapeFill, setShapeFill, eraseMode, currentColor, gradientControls, GRADIENT_TYPES, removeBlinkStep, addBlinkColor, addBlinkNone, setBlinkStepFrames, clearBlinkCells, setSnakeLength, setSnakeSegment, fillSnakeBody, dragSwatchRef, updateSelectedLayer, arrMove, swatchStyle, removeSnakeStop, addSnakeStop, NONE_CHIP, RAINBOW, fadeSnakeBody, setSnakeSpeed, clamp, clearSnakePath } = useStudio();
  return (
    <>
          {/* ---------- selected-layer editor ---------- */}
          {sel && sel.type === "art" && (
            <div className="text-xs rounded-md p-3 space-y-2 border" style={{ backgroundColor: "#fffbeb", borderColor: "#fcd34d" }}>
              <div className="font-semibold uppercase tracking-wide" style={{ color: "#92400e" }}>Artwork layer</div>
              <div style={{ color: "#78350f" }}><b>Click/drag</b> to paint, <b>Shift-drag</b> for a rectangle. Pick <b>None</b> to erase to transparent.</div>
              <div className="flex gap-2">
                <button onClick={togglePick} title="Eyedropper — sample a cell's exact color"
                  className={"flex-1 h-9 rounded-md border text-xs font-medium flex items-center justify-center gap-1.5 bg-white " + (paintTool === "pick" ? "ring-2 ring-indigo-500 border-indigo-500 text-indigo-700" : "border-neutral-300 text-neutral-700 hover:bg-neutral-50")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" /></svg>
                  Eyedropper
                </button>
                <button onClick={toggleGradient} title="Gradient — drag a multi-stop gradient"
                  className={"flex-1 h-9 rounded-md border text-xs font-medium flex items-center justify-center " + (paintTool === "gradient" ? "ring-2 ring-indigo-500 border-indigo-500" : "border-neutral-300")}
                  style={{ backgroundImage: `linear-gradient(to right, ${cssStops(gradStops)})` }}>
                  <span className="px-2 py-0.5 rounded bg-white text-neutral-800">Gradient</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-wide shrink-0" style={{ color: "#92400e" }}>Shape</span>
                <select value={shapeKind} onChange={(e) => { setShapeKind(e.target.value); setPaintTool("shape"); }}
                  className="flex-1 px-2 py-1.5 rounded-md border border-neutral-300 bg-white text-xs text-neutral-800 focus:outline-none focus:border-neutral-500">
                  {SHAPE_KINDS.map(([v, lbl]) => (<option key={v} value={v}>{lbl}</option>))}
                </select>
                <button onClick={() => setPaintTool((t) => (t === "shape" ? "brush" : "shape"))} title="Toggle shape drawing"
                  className={"px-3 py-1.5 rounded-md border text-xs font-medium " + (paintTool === "shape" ? "ring-2 ring-indigo-500 border-indigo-500 text-indigo-700 bg-white" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50")}>Draw</button>
              </div>
              {paintTool === "gradient" && (
                <div className="rounded-md bg-white border border-amber-200 p-2 space-y-2">
                  <div style={{ color: "#78350f" }}>{gradStops.length >= 2 ? "Drag a rectangle on the grid to lay the gradient." : "Add at least 2 colors."}</div>
                  {gradientControls()}
                </div>
              )}
              {paintTool === "shape" && (
                <div className="rounded-md bg-white border border-amber-200 p-2 space-y-2">
                  <div style={{ color: "#78350f" }}>Drag on the grid to draw a {SHAPE_KINDS.find(([v]) => v === shapeKind)?.[1] || shapeKind}{eraseMode && shapeFill === "solid" ? " (erases to transparent)" : ""}. Hold <b>Shift</b> for a perfect square/circle.</div>
                  <div className="flex items-center gap-2">
                    <span className="uppercase tracking-wide" style={{ color: "#92400e" }}>Fill</span>
                    <button onClick={() => setShapeFill("solid")} className={"px-2 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 " + (shapeFill === "solid" ? "ring-2 ring-indigo-500 border-indigo-500 text-indigo-700 bg-white" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50")}>
                      <span className="w-3 h-3 rounded-sm border border-neutral-300" style={eraseMode ? undefined : { backgroundColor: currentColor }} />
                      Solid
                    </button>
                    <button onClick={() => setShapeFill("gradient")} className={"px-2 py-1 rounded-md border text-xs font-medium " + (shapeFill === "gradient" ? "ring-2 ring-indigo-500 border-indigo-500" : "border-neutral-300")}
                      style={{ backgroundImage: `linear-gradient(to right, ${cssStops(gradStops)})` }}>
                      <span className="px-2 py-0.5 rounded bg-white text-neutral-800">Gradient</span>
                    </button>
                  </div>
                  {shapeFill === "gradient" && (gradStops.length >= 2 ? gradientControls() : <div style={{ color: "#78350f" }}>Add at least 2 colors below.</div>)}
                </div>
              )}
              {paintTool === "pick" && (<div style={{ color: "#78350f" }}>Click a cell to copy its exact color, then back to the brush.</div>)}
            </div>
          )}

          {sel && GRADIENT_TYPES.indexOf(sel.type) >= 0 && <GradientPanel layer={sel} />}
          {sel && sel.type === "glitters" && <GlittersPanel layer={sel} />}
          {sel && sel.type === "electron" && <ElectronPanel layer={sel} />}
          {sel && sel.type === "flies" && <FliesPanel layer={sel} />}
          {sel && sel.type === "trace" && <TracePanel layer={sel} />}

          {sel && sel.type === "blink" && (
            <div className="text-xs rounded-md bg-indigo-50 border border-indigo-200 p-3 space-y-3">
              <div className="font-semibold text-indigo-800 uppercase tracking-wide">Blink layer</div>
              <div className="text-indigo-900"><b>Click</b> a cell to toggle it; <b>drag</b> to paint, <b>Shift-drag</b> to erase.</div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-indigo-700 uppercase tracking-wide">Sequence</span>
                  <span className="font-mono text-indigo-500">{sel.sequence.length} / 32</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {sel.sequence.length === 0 && (<span className="text-indigo-400">No steps — add at least one.</span>)}
                  {sel.sequence.map((step, i) => (
                    <button key={i} onClick={() => removeBlinkStep(i)} title="Remove this step"
                      className="w-7 h-7 rounded border border-neutral-300 bg-white flex items-center justify-center hover:border-red-400" style={step != null ? { backgroundColor: step } : undefined}>
                      {step == null && (<svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="14" x2="14" y2="2" stroke="#94a3b8" strokeWidth="2" /></svg>)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={addBlinkColor} disabled={sel.sequence.length >= 32}
                  className={"px-2 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 " + (sel.sequence.length >= 32 ? "border-neutral-200 text-neutral-300 bg-neutral-50 cursor-not-allowed" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
                  <span className="w-3 h-3 rounded-sm border border-neutral-300" style={{ backgroundColor: currentColor }} />
                  + Color
                </button>
                <button onClick={addBlinkNone} disabled={sel.sequence.length >= 32}
                  className={"px-2 py-1 rounded-md border text-xs font-medium " + (sel.sequence.length >= 32 ? "border-neutral-200 text-neutral-300 bg-neutral-50 cursor-not-allowed" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
                  + None
                </button>
              </div>
              <SpeedSlider frames={sel.stepFrames} setFrames={(f) => setBlinkStepFrames(f)} fmax={60} />
              <div className="font-mono text-indigo-500">{sel.cells.size} cells</div>
              {sel.cells.size > 0 && (
                <button onClick={clearBlinkCells} className="px-2 py-1 rounded-md border border-neutral-300 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100">Clear cells</button>
              )}
              <div className="text-indigo-500">Each step holds for its frames; press <b>Play</b> to preview.</div>
            </div>
          )}

          {sel && sel.type === "snake" && (
            <div className="text-xs rounded-md bg-indigo-50 border border-indigo-200 p-3 space-y-3">
              <div className="font-semibold text-indigo-800 uppercase tracking-wide">Snake layer</div>
              <label className="flex items-center gap-1.5 text-indigo-700">
                <span className="uppercase tracking-wide">Size (cells)</span>
                <input type="number" min="1" max="64" value={sel.length} onChange={(e) => setSnakeLength(e.target.value)}
                  className="w-16 px-2 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-neutral-800 focus:outline-none focus:border-neutral-500" />
              </label>
              <div>
                <div className="text-indigo-700 uppercase tracking-wide mb-1">Body (head → tail)</div>
                <div className="flex flex-wrap gap-1">
                  {sel.colors.map((col, i) => (
                    <button key={i} onClick={() => setSnakeSegment(i)} title={`Segment ${i + 1}${i === 0 ? " (head)" : ""} — set to current color/None`}
                      className={"w-7 h-7 rounded border relative overflow-hidden bg-white " + (i === 0 ? "border-indigo-500 ring-1 ring-indigo-400" : "border-neutral-300 hover:border-indigo-400")}
                      style={col != null ? { backgroundColor: col } : undefined}>
                      {col == null && (<svg viewBox="0 0 28 28" className="absolute inset-0 w-full h-full"><line x1="4" y1="24" x2="24" y2="4" stroke="#ef4444" strokeWidth="2.5" /></svg>)}
                    </button>
                  ))}
                </div>
                <div className="text-indigo-500 mt-1">Click a segment to paint it with the current color (or <b>None</b>).</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={fillSnakeBody} className="px-2 py-1 rounded-md border border-neutral-300 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100 flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm border border-neutral-300" style={eraseMode ? undefined : { backgroundColor: currentColor }} />
                  Fill solid
                </button>
              </div>
              <div className="rounded-md bg-white border border-indigo-200 p-2 space-y-2">
                <div className="text-indigo-700 uppercase tracking-wide">Body gradient</div>
                <div className="h-3 rounded" style={{ backgroundImage: `linear-gradient(to right, ${cssStops(sel.bodyStops || [currentColor, "#1e1b4b"])})`, border: "1px solid #e5e5e5" }} />
                <div className="flex flex-wrap gap-1">
                  {(sel.bodyStops || []).map((col, i) => (
                    <button key={i} draggable
                      onDragStart={() => { dragSwatchRef.current = { kind: "snake", i }; }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => { const s = dragSwatchRef.current; if (s && s.kind === "snake" && s.i !== i) updateSelectedLayer((st) => ({ ...st, bodyStops: arrMove(st.bodyStops || [], s.i, i) })); dragSwatchRef.current = null; }}
                      onClick={() => removeSnakeStop(i)} title={(sel.bodyStops || []).length <= 2 ? "At least 2 stops" : (col === "none" ? "Transparent · drag to reorder · click to remove" : "Drag to reorder · click to remove")}
                      className="w-7 h-7 rounded border border-neutral-300 hover:border-red-400" style={{ ...swatchStyle(col), cursor: "grab" }} />
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={addSnakeStop} disabled={(sel.bodyStops || []).length >= 16}
                    className={"px-2 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 " + ((sel.bodyStops || []).length >= 16 ? "border-neutral-200 text-neutral-300 bg-neutral-50 cursor-not-allowed" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
                    <span className="w-3 h-3 rounded-sm border border-neutral-300" style={eraseMode ? undefined : { backgroundColor: currentColor }} />
                    + Color
                  </button>
                  <button onClick={() => updateSelectedLayer((s) => ((s.bodyStops || []).length >= 16 ? s : { ...s, bodyStops: [...(s.bodyStops || []), "none"] }))} disabled={(sel.bodyStops || []).length >= 16} title="Add a transparent stop"
                    className={"px-2 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 " + ((sel.bodyStops || []).length >= 16 ? "border-neutral-200 text-neutral-300 bg-neutral-50 cursor-not-allowed" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
                    <span className="w-3 h-3 rounded-sm border border-neutral-300" style={NONE_CHIP} />
                    + None
                  </button>
                  <button onClick={() => updateSelectedLayer((s) => ({ ...s, bodyStops: RAINBOW.slice() }))} className="px-2 py-1 rounded-md border border-neutral-300 text-xs font-medium text-neutral-800 hover:opacity-90"
                    style={{ backgroundImage: "linear-gradient(to right, #ff0000,#ffaa00,#ffff00,#00cc00,#00bccc,#0066ff,#7a00ff,#ff00aa)" }}>
                    <span className="px-1 rounded bg-white">Rainbow</span>
                  </button>
                  <button onClick={fadeSnakeBody} className="px-2 py-1 rounded-md border border-indigo-300 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100">Apply to body</button>
                </div>
              </div>
              <SpeedSlider frames={sel.speed} setFrames={(f) => setSnakeSpeed(f)} fmax={30} fmin={0.5} />
              <div className="rounded-md bg-white border border-indigo-200 p-2 space-y-2">
                <label className="flex items-center gap-2 text-indigo-700 cursor-pointer">
                  <input type="checkbox" checked={!!sel.electric} onChange={(e) => updateSelectedLayer((s) => ({ ...s, electric: e.target.checked }))} style={{ accentColor: "#4f46e5" }} />
                  <span className="uppercase tracking-wide">Electric</span>
                  <span className="text-indigo-400">{sel.electric ? "arcs haywire now and then" : "steady"}</span>
                </label>
                {sel.electric && (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-indigo-700 uppercase tracking-wide">Arc color</span>
                      <button onClick={() => updateSelectedLayer((s) => ({ ...s, electricColor: eraseMode ? "#bfefff" : currentColor }))} title="Set the arc/lightning color to the current swatch"
                        className="w-6 h-6 rounded border border-neutral-300" style={{ backgroundColor: sel.electricColor || "#bfefff" }} />
                    </div>
                    <label className="flex items-center gap-1.5 text-indigo-700"><span className="uppercase tracking-wide">Bursts / loop</span>
                      <input type="number" min="1" max="8" value={sel.arcBursts == null ? 3 : sel.arcBursts} onChange={(e) => updateSelectedLayer((s) => ({ ...s, arcBursts: clamp(parseInt(e.target.value, 10) || 1, 1, 8) }))}
                        className="w-12 px-1 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
                    </label>
                  </div>
                )}
                {sel.electric && (
                  <label className="flex items-center gap-2 text-indigo-700"><span className="uppercase tracking-wide">Arc size</span>
                    <input type="range" min="1" max="10" value={sel.arcSize == null ? 3 : sel.arcSize} onChange={(e) => updateSelectedLayer((s) => ({ ...s, arcSize: clamp(parseInt(e.target.value, 10) || 1, 1, 10) }))} className="flex-1" style={{ accentColor: "#4f46e5" }} title="how far the bolt reaches and how wildly the body jitters" />
                    <span className="font-mono text-indigo-500 w-6 text-right">{sel.arcSize == null ? 3 : sel.arcSize}</span>
                  </label>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-indigo-500">{sel.path.length > 0 ? `path: ${sel.path.length} cells` : "no path — drag on the grid"}</span>
                {sel.path.length > 0 && (<button onClick={clearSnakePath} className="ml-auto px-2 py-1 rounded-md border border-neutral-300 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100">Clear path</button>)}
              </div>
              <div className="text-indigo-600"><b>Drag</b> on the grid to draw the path the snake follows. The head leads; the body trails behind.</div>
            </div>
          )}
    </>
  );
}
