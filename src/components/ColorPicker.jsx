import React from "react";
import { useStudio } from "../studio/StudioContext.jsx";

export default function ColorPicker() {
  const { eraseMode, currentColor, labelCls, hexField, onHexChange, fieldCls, togglePick, paintTool, svRef, svDrag, svUpdate, hsv, hueRef, hueDrag, hueUpdate, cmyk, setCmyk } = useStudio();
  return (
    <>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-md border border-neutral-300 shadow-sm shrink-0 relative overflow-hidden bg-white"
              style={{ ...(eraseMode ? {} : { backgroundColor: currentColor }), cursor: eraseMode ? "default" : "grab" }}
              draggable={!eraseMode}
              onDragStart={(e) => { if (eraseMode) { e.preventDefault(); return; } e.dataTransfer.effectAllowed = "copy"; try { e.dataTransfer.setData("text/plain", currentColor); } catch (_) {} }}
              title={eraseMode ? "None (transparent)" : "Drag onto Custom to save this color"}
            >
              {eraseMode && (<svg viewBox="0 0 48 48" className="absolute inset-0 w-full h-full"><line x1="6" y1="42" x2="42" y2="6" stroke="#ef4444" strokeWidth="3" /></svg>)}
            </div>
            <div className="flex-1">
              <label className={labelCls}>{eraseMode ? "None (transparent)" : "Hex"}</label>
              <input value={hexField} onChange={(e) => onHexChange(e.target.value)} className={fieldCls} />
            </div>
            <button onClick={togglePick} title="Eyedropper — sample any cell's color (effects included) into this swatch"
              className={"shrink-0 w-9 h-9 mt-4 rounded-md border flex items-center justify-center bg-white " + (paintTool === "pick" ? "ring-2 ring-indigo-500 border-indigo-500 text-indigo-700" : "border-neutral-300 text-neutral-600 hover:bg-neutral-50")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" /></svg>
            </button>
          </div>

          <div>
            <div ref={svRef}
              onPointerDown={(e) => { svDrag.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} svUpdate(e); }}
              onPointerMove={(e) => { if (svDrag.current) svUpdate(e); }}
              onPointerUp={() => { svDrag.current = false; }}
              className="relative w-full rounded-md cursor-crosshair border border-neutral-300"
              style={{ height: "150px", backgroundColor: `hsl(${hsv.h},100%,50%)`, backgroundImage: "linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0))", touchAction: "none" }}>
              <div className="absolute w-3 h-3 rounded-full border-2 border-white" style={{ left: `calc(${hsv.s * 100}% - 6px)`, top: `calc(${(1 - hsv.v) * 100}% - 6px)`, boxShadow: "0 0 0 1px rgba(0,0,0,0.5)" }} />
            </div>
            <div ref={hueRef}
              onPointerDown={(e) => { hueDrag.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} hueUpdate(e); }}
              onPointerMove={(e) => { if (hueDrag.current) hueUpdate(e); }}
              onPointerUp={() => { hueDrag.current = false; }}
              className="relative w-full h-4 rounded-md cursor-pointer mt-2 border border-neutral-300"
              style={{ backgroundImage: "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)", touchAction: "none" }}>
              <div className="absolute top-0 h-4 w-1.5 rounded-sm border border-white" style={{ left: `calc(${(hsv.h / 360) * 100}% - 3px)`, boxShadow: "0 0 0 1px rgba(0,0,0,0.5)" }} />
            </div>
          </div>

          <div>
            <label className={labelCls}>CMYK</label>
            <div className="grid grid-cols-4 gap-2">
              {[["C", "c"], ["M", "m"], ["Y", "y"], ["K", "k"]].map(([lab, key]) => (
                <div key={key}>
                  <div className="text-center text-xs text-neutral-400 mb-1">{lab}</div>
                  <input type="number" min="0" max="100" value={cmyk[key]} onChange={(e) => setCmyk(key, e.target.value)}
                    className="w-full px-1 py-1.5 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
                </div>
              ))}
            </div>
          </div>
    </>
  );
}
