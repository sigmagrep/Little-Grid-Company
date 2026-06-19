import React from "react";
import { useStudio } from "../studio/StudioContext.jsx";

export default function PalettePanel() {
  const { labelCls, setPaletteMenuOpen, paletteMenuOpen, activeSaved, savedPalettes, setActiveSaved, swatchStyle, selectNone, eraseMode, PALETTE, selectPaletteColor, paletteDragOver, setPaletteDragOver, currentColor, addCustomColor, customPalette, removeCustomColor, paletteName, setPaletteName, saveCustomPalette, setCustomPalette, deleteSavedPalette, recent } = useStudio();
  return (
    <>
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls + " mb-0"}>Palette</label>
              <button onClick={() => setPaletteMenuOpen((o) => !o)} title="Saved palettes"
                className={"flex items-center justify-center w-6 h-6 rounded-md border " + (paletteMenuOpen || activeSaved ? "border-indigo-400 text-indigo-600 bg-indigo-50" : "border-neutral-300 text-neutral-600 bg-white hover:bg-neutral-100")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1 .9-1.5 2-1.5H16.5A4.5 4.5 0 0 0 22 11.5C22 6.3 17.5 2 12 2Z" />
                  <circle cx="7.5" cy="11" r="1.1" /><circle cx="12" cy="7.5" r="1.1" /><circle cx="16.5" cy="11" r="1.1" />
                </svg>
              </button>
              {paletteMenuOpen && (
                <div className="absolute right-0 z-20 rounded-md border border-neutral-200 bg-white shadow-lg py-1" style={{ top: "26px", minWidth: "11rem" }}>
                  {savedPalettes.length === 0 ? (
                    <div className="px-3 py-1.5 text-xs text-neutral-400">No saved palettes yet</div>
                  ) : savedPalettes.map((p) => (
                    <button key={p.name} onClick={() => { setActiveSaved(p.name); setPaletteMenuOpen(false); }}
                      className={"w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-neutral-100 " + (activeSaved === p.name ? "text-indigo-700 font-medium" : "text-neutral-700")}>
                      <span className="flex gap-0.5 shrink-0">{p.colors.slice(0, 5).map((c, j) => (<span key={j} className="w-2.5 h-2.5 rounded-sm border border-neutral-200" style={swatchStyle(c)} />))}</span>
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                  {activeSaved && (<button onClick={() => { setActiveSaved(""); setPaletteMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100 border-t border-neutral-100">Hide saved section</button>)}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              <button onClick={selectNone} title="None (transparent / eraser)"
                className={"w-7 h-7 rounded border bg-white relative overflow-hidden transition-transform hover:scale-110 " + (eraseMode ? "ring-2 ring-indigo-500 border-indigo-500" : "border-neutral-300")}>
                <svg viewBox="0 0 28 28" className="absolute inset-0 w-full h-full"><line x1="4" y1="24" x2="24" y2="4" stroke="#ef4444" strokeWidth="2.5" /></svg>
              </button>
              {PALETTE.map((col) => (
                <button key={col} onClick={() => selectPaletteColor(col)} className="w-7 h-7 rounded border border-neutral-300 transition-transform hover:scale-110" style={{ backgroundColor: col }} title={col} />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls + " mb-0"}>Custom</label>
              <span className="text-xs text-neutral-400">drag swatch here, or +</span>
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; if (!paletteDragOver) setPaletteDragOver(true); }}
              onDragLeave={() => setPaletteDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setPaletteDragOver(false); let c = ""; try { c = e.dataTransfer.getData("text/plain"); } catch (_) {} if (!/^#([0-9a-fA-F]{6})$/.test(c)) c = eraseMode ? "" : currentColor; addCustomColor(c); }}
              className="flex flex-wrap gap-1 rounded-md border border-dashed p-1"
              style={{ minHeight: "2.25rem", borderColor: paletteDragOver ? "#4f46e5" : "#d4d4d4", backgroundColor: paletteDragOver ? "#eef2ff" : "transparent" }}
            >
              {customPalette.length === 0 && !paletteDragOver && (
                <span className="text-xs text-neutral-400 px-1 py-1.5 select-none">No saved colors yet.</span>
              )}
              {customPalette.map((col, i) => (
                <span key={i} className="relative inline-block">
                  <button onClick={() => selectPaletteColor(col)} className="w-7 h-7 rounded border border-neutral-300 transition-transform hover:scale-110 block" style={{ backgroundColor: col }} title={col} />
                  <button onClick={(e) => { e.stopPropagation(); removeCustomColor(i); }} title="Remove"
                    className="absolute rounded-full bg-neutral-700 text-white flex items-center justify-center leading-none"
                    style={{ top: "-5px", right: "-5px", width: "14px", height: "14px", fontSize: "9px" }}>×</button>
                </span>
              ))}
              <button onClick={() => { if (!eraseMode) addCustomColor(currentColor); }} disabled={eraseMode} title="Add the current color"
                className={"w-7 h-7 rounded border border-dashed flex items-center justify-center text-neutral-500 " + (eraseMode ? "border-neutral-200 text-neutral-300 cursor-not-allowed" : "border-neutral-400 hover:bg-neutral-100")}>+</button>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <input value={paletteName} onChange={(e) => setPaletteName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveCustomPalette(paletteName); }}
                placeholder="name this palette…" className="flex-1 px-2 py-1 rounded-md border border-neutral-300 bg-white text-xs text-neutral-700 focus:outline-none focus:border-neutral-500" />
              <button onClick={() => saveCustomPalette(paletteName)} disabled={!customPalette.length || !paletteName.trim()} title={customPalette.length ? "Save this palette" : "Add colors to Custom first"}
                className={"px-2.5 py-1 rounded-md border text-xs font-medium flex items-center gap-1 " + (customPalette.length && paletteName.trim() ? "border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100" : "border-neutral-200 text-neutral-300 bg-neutral-50 cursor-not-allowed")}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>
                Save
              </button>
            </div>
          </div>

          {(() => {
            const active = savedPalettes.find((p) => p.name === activeSaved);
            if (!active) return null;
            return (
              <div className="rounded-md border border-neutral-200 p-1.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-neutral-600">{active.name} <span className="text-neutral-400">(saved)</span></span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCustomPalette(active.colors.filter((c) => c !== "none").slice(0, 32))} title="Load into Custom" className="text-xs px-1.5 py-0.5 rounded border border-neutral-300 text-neutral-600 bg-white hover:bg-neutral-100">→ Custom</button>
                    <button onClick={() => deleteSavedPalette(active.name)} title="Delete this palette" className="text-neutral-400 hover:text-red-600">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {active.colors.map((col, i) => (
                    <button key={i} onClick={() => selectPaletteColor(col)} className="w-7 h-7 rounded border border-neutral-300 transition-transform hover:scale-110" style={swatchStyle(col)} title={col} />
                  ))}
                </div>
              </div>
            );
          })()}

          <div>
            <label className={labelCls}>Recent</label>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 12 }).map((_, i) => {
                const col = recent[i];
                return col ? (
                  <button key={i} onClick={() => selectPaletteColor(col)} className="w-7 h-7 rounded border border-neutral-300 transition-transform hover:scale-110" style={{ backgroundColor: col }} title={col} />
                ) : (<div key={i} className="w-7 h-7 rounded border border-dashed border-neutral-300 bg-neutral-50" />);
              })}
            </div>
          </div>
    </>
  );
}
