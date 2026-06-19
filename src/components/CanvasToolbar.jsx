import React from "react";
import { useStudio } from "../studio/StudioContext.jsx";

export default function CanvasToolbar() {
  const { labelCls, inputW, setInputW, inputH, setInputH, applyDims, undoRef, undoCount, exportPng, exportGif, isExporting } = useStudio();
  return (
    <>
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label className={labelCls}>Width (px)</label>
              <input type="number" min="1" value={inputW} onChange={(e) => setInputW(e.target.value)} className="w-24 px-2 py-1.5 rounded-md border border-neutral-300 bg-white text-sm font-mono focus:outline-none focus:border-neutral-500" />
            </div>
            <span className="pb-2 text-neutral-400">×</span>
            <div>
              <label className={labelCls}>Height (px)</label>
              <input type="number" min="1" value={inputH} onChange={(e) => setInputH(e.target.value)} className="w-24 px-2 py-1.5 rounded-md border border-neutral-300 bg-white text-sm font-mono focus:outline-none focus:border-neutral-500" />
            </div>
            <button onClick={applyDims} className="px-4 py-1.5 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 transition-colors">Apply</button>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => undoRef.current()} disabled={undoCount === 0} title="Undo (Ctrl/Cmd+Z)"
                className={"px-3 py-1.5 rounded-md border text-sm font-medium transition-colors flex items-center gap-1.5 " + (undoCount === 0 ? "border-neutral-200 text-neutral-300 bg-neutral-50 cursor-not-allowed" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
                Undo
              </button>
              <button onClick={exportPng} title="Export the flattened stack as a PNG" className="px-3 py-1.5 rounded-md border border-neutral-300 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-100 transition-colors flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></svg>
                Export PNG
              </button>
              <button onClick={exportGif} disabled={isExporting} title="Export as animated GIF at real pixel size"
                className={"px-3 py-1.5 rounded-md border text-sm font-medium transition-colors flex items-center gap-1.5 " + (isExporting ? "border-neutral-200 text-neutral-400 bg-neutral-50 cursor-wait" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2" /><path d="M7 3v18M17 3v18M2 9h5M2 15h5M17 9h5M17 15h5" /></svg>
                {isExporting ? "Exporting…" : "Export GIF"}
              </button>
            </div>
          </div>
    </>
  );
}
