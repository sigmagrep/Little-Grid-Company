import React from "react";
import { useStudio } from "../studio/StudioContext.jsx";

export default function DesignBar() {
  const { designText, setDesignText, copyDesign, copiedDesign, applyDesign, setError, error } = useStudio();
  return (
    <>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs uppercase tracking-wide text-neutral-500 shrink-0">Design</label>
            <input value={designText} onChange={(e) => setDesignText(e.target.value)} placeholder="paste a design code here to import…" spellCheck={false}
              className="flex-1 px-2 py-1.5 rounded-md border border-neutral-300 bg-white text-xs font-mono text-neutral-700 focus:outline-none focus:border-neutral-500" style={{ minWidth: "12rem" }} />
            <button onClick={copyDesign}
              title="Encode the whole design (size, fps, every layer + its parameters, artwork pixels) and copy it to the clipboard"
              className={"px-3 py-1.5 rounded-md border text-sm font-medium transition-colors shrink-0 flex items-center gap-1.5 " + (copiedDesign ? "border-green-400 text-green-700 bg-green-50" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
              {copiedDesign ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
              )}
              {copiedDesign ? "Copied!" : "Copy"}
            </button>
            <button onClick={() => { if (applyDesign(designText)) setError(""); else setError("Couldn't read that design code."); }}
              title="Rebuild the design from the code in the box"
              className="px-3 py-1.5 rounded-md border border-neutral-300 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-100 transition-colors shrink-0">Import</button>
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
    </>
  );
}
