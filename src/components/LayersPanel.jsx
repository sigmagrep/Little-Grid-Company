import React from "react";
import { useStudio } from "../studio/StudioContext.jsx";

export default function LayersPanel() {
  const { labelCls, addLayer, LAYER_ACCENT, EFFECT_TYPES, LAYER_LABEL, layers, selectedLayerId, layerColorHint, dragLayerIdRef, dropTarget, setDropTarget, dropOnLayer, setSelectedLayerId, toggleLayerVisible, moveLayer, duplicateLayer, canMergeDown, mergeDown, deleteLayer } = useStudio();
  return (
    <>
          <div>
            <label className={labelCls}>Layers</label>
            <button onClick={() => addLayer("art")} title="Add another artwork (paint) layer" className="w-full h-8 rounded-md border border-amber-300 bg-amber-50 text-xs font-medium text-amber-800 hover:bg-amber-100 flex items-center justify-center gap-1.5 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: LAYER_ACCENT.art }} />
              + Artwork
            </button>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {EFFECT_TYPES.map((t) => (
                <button key={t} onClick={() => addLayer(t)} title={`Add a ${LAYER_LABEL[t]} layer`} className="h-8 rounded-md border border-neutral-300 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 flex items-center justify-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: LAYER_ACCENT[t] }} />
                  + {LAYER_LABEL[t]}
                </button>
              ))}
            </div>
            <div className="rounded-md border border-neutral-200 divide-y divide-neutral-100 overflow-hidden">
              {[...layers].reverse().map((l) => {
                const isSel = l.id === selectedLayerId;
                const sameType = layers.filter((x) => x.type === l.type);
                const typeIndex = sameType.findIndex((x) => x.id === l.id) + 1;
                const artCount = layers.filter((x) => x.type === "art").length;
                const idx = layers.findIndex((x) => x.id === l.id);
                const isFront = idx === layers.length - 1, isBack = idx === 0;
                const hint = layerColorHint(l);
                return (
                  <div key={l.id}
                    draggable
                    onDragStart={(e) => { dragLayerIdRef.current = l.id; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(l.id)); } catch (_) {} }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragLayerIdRef.current === l.id) { if (dropTarget) setDropTarget(null); return; } const r = e.currentTarget.getBoundingClientRect(); const where = (e.clientY - r.top) < r.height / 2 ? "above" : "below"; if (!dropTarget || dropTarget.id !== l.id || dropTarget.where !== where) setDropTarget({ id: l.id, where }); }}
                    onDrop={(e) => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); const where = (e.clientY - r.top) < r.height / 2 ? "above" : "below"; dropOnLayer(l.id, where); setDropTarget(null); }}
                    onDragEnd={() => { dragLayerIdRef.current = null; setDropTarget(null); }}
                    onClick={() => setSelectedLayerId(l.id)}
                    className={"flex items-center gap-1.5 pr-2 py-1.5 cursor-pointer " + (isSel ? "bg-indigo-50" : "bg-white hover:bg-neutral-50")}
                    style={{ borderLeft: `4px solid ${LAYER_ACCENT[l.type]}`, boxShadow: dropTarget && dropTarget.id === l.id ? (dropTarget.where === "above" ? "inset 0 3px 0 0 #4f46e5" : "inset 0 -3px 0 0 #4f46e5") : "none" }}>
                    <span className="text-neutral-300 px-1 cursor-grab" title="Drag to reorder">⠿</span>
                    <span className="w-4 h-4 rounded-sm border border-neutral-300 shrink-0 relative overflow-hidden bg-white" style={hint ? { backgroundColor: hint } : undefined}>
                      {l.type === "art" ? (
                        <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full p-0.5" fill="none" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21c3 0 4-2 4-4s-2-2-2-2" /><path d="M14 5l5 5L9 20l-5-1-1-4z" /></svg>
                      ) : !hint ? (
                        <svg viewBox="0 0 16 16" className="absolute inset-0 w-full h-full"><line x1="2" y1="14" x2="14" y2="2" stroke="#cbd5e1" strokeWidth="2" /></svg>
                      ) : null}
                    </span>
                    <span className={"text-xs font-medium truncate flex-1 " + (isSel ? "text-indigo-800" : "text-neutral-700")}>
                      {l.type === "art" ? `Artwork${artCount > 1 ? ` ${typeIndex}` : ""}` : `${LAYER_LABEL[l.type]}${sameType.length > 1 ? ` ${typeIndex}` : ""}`}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); toggleLayerVisible(l.id); }} title={l.visible ? "Hide layer" : "Show layer"} className="text-neutral-400 hover:text-neutral-700 shrink-0">
                      {l.visible ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.9 4.2A9 9 0 0 1 12 4c6.5 0 10 7 10 7a13 13 0 0 1-2 2.7M6 6.3A13 13 0 0 0 2 11s3.5 7 10 7a9 9 0 0 0 3.7-.8" /><path d="m2 2 20 20" /></svg>
                      )}
                    </button>
                    <div className="flex flex-col leading-none shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); moveLayer(l.id, 1); }} disabled={isFront} title="Move up" style={{ fontSize: "10px", lineHeight: 1 }} className={isFront ? "text-neutral-200" : "text-neutral-500 hover:text-neutral-800"}>▲</button>
                      <button onClick={(e) => { e.stopPropagation(); moveLayer(l.id, -1); }} disabled={isBack} title="Move down" style={{ fontSize: "10px", lineHeight: 1 }} className={isBack ? "text-neutral-200" : "text-neutral-500 hover:text-neutral-800"}>▼</button>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); duplicateLayer(l.id); }} title="Duplicate this layer" className="text-neutral-400 hover:text-indigo-600 shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
                    </button>
                    {canMergeDown(l) && (
                      <button onClick={(e) => { e.stopPropagation(); mergeDown(l.id); }} title="Merge down into the artwork below" className="text-neutral-400 hover:text-indigo-600 shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 12 5 5 5-5" /><path d="M5 21h14" /></svg>
                      </button>
                    )}
                    {l.type === "art" && artCount <= 1 ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" className="shrink-0"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); deleteLayer(l.id); }} title="Delete layer" className="text-neutral-400 hover:text-red-600 shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-neutral-400 mt-1">Top = front. Drag the handle or use ▲▼ to reorder; the eye hides a layer.</div>
          </div>
    </>
  );
}
