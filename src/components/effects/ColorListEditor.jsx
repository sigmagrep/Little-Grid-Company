import React from "react";
import { useStudio } from "../../studio/StudioContext.jsx";
import { RAINBOW } from "../../lib/effects.js";

const CAP = 64;

// Reorderable color list shared by the effect panels. `colors` is the current list,
// `set(updater)` mutates the selected layer, `lo` is the minimum number of colors.
export default function ColorListEditor({ colors, set, lo }) {
  const { currentColor, eraseMode, swatchStyle, NONE_CHIP, arrMove, dragSwatchRef } = useStudio();

  const addColor = () => set((s) => (s.colors.length >= CAP ? s : { ...s, colors: [...s.colors, currentColor] }));
  const addNone = () => set((s) => (s.colors.length >= CAP ? s : { ...s, colors: [...s.colors, "none"] }));
  const removeColor = (i) => set((s) => (s.colors.length <= lo ? s : { ...s, colors: s.colors.filter((_, j) => j !== i) }));
  const rainbow = () => set((s) => ({ ...s, colors: RAINBOW.slice() }));
  const importColors = () => {
    if (typeof window === "undefined") return;
    const txt = window.prompt("Paste colors (hex, or 'none' — any separators):", colors.join(", "));
    if (txt == null) return;
    const found = (txt.match(/#?[0-9a-fA-F]{6}\b|none/gi) || []).map((h) => (/^none$/i.test(h) ? "none" : "#" + h.replace("#", "").toLowerCase())).slice(0, CAP);
    if (found.length >= lo) set((s) => ({ ...s, colors: found }));
  };

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-indigo-700 uppercase tracking-wide">Colors</span>
          <span className="font-mono text-indigo-500">{colors.length} / {CAP}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {colors.map((col, i) => (
            <button key={i} draggable
              onDragStart={() => { dragSwatchRef.current = { kind: "effect", i }; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { const s = dragSwatchRef.current; if (s && s.kind === "effect" && s.i !== i) set((st) => ({ ...st, colors: arrMove(st.colors, s.i, i) })); dragSwatchRef.current = null; }}
              onClick={() => removeColor(i)} title={colors.length <= lo ? `At least ${lo}` : (col === "none" ? "Transparent · drag to reorder · click to remove" : "Drag to reorder · click to remove")}
              className="w-7 h-7 rounded border border-neutral-300 hover:border-red-400" style={{ ...swatchStyle(col), cursor: "grab" }} />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={addColor} disabled={colors.length >= CAP}
          className={"px-2 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 " + (colors.length >= CAP ? "border-neutral-200 text-neutral-300 bg-neutral-50 cursor-not-allowed" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
          <span className="w-3 h-3 rounded-sm border border-neutral-300" style={eraseMode ? undefined : { backgroundColor: currentColor }} />
          + Color
        </button>
        <button onClick={addNone} disabled={colors.length >= CAP} title="Add a transparent stop"
          className={"px-2 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 " + (colors.length >= CAP ? "border-neutral-200 text-neutral-300 bg-neutral-50 cursor-not-allowed" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
          <span className="w-3 h-3 rounded-sm border border-neutral-300" style={NONE_CHIP} />
          + None
        </button>
        <button onClick={rainbow} className="px-2 py-1 rounded-md border border-neutral-300 text-xs font-medium text-neutral-800 hover:opacity-90"
          style={{ backgroundImage: "linear-gradient(to right, #ff0000,#ffaa00,#ffff00,#00cc00,#00bccc,#0066ff,#7a00ff,#ff00aa)" }}>
          <span className="px-1 rounded bg-white">Rainbow</span>
        </button>
        <button onClick={importColors} title="Paste a list of hex colors (or none) to replace the list" className="px-2 py-1 rounded-md border border-neutral-300 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100">Paste palette</button>
      </div>
    </>
  );
}
