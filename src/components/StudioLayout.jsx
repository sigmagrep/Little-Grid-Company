import React from "react";
import { useStudio } from "../studio/StudioContext.jsx";
import ColorPicker from "./ColorPicker.jsx";
import PalettePanel from "./PalettePanel.jsx";
import LayersPanel from "./LayersPanel.jsx";
import LayerEditor from "./LayerEditor.jsx";
import CanvasToolbar from "./CanvasToolbar.jsx";
import DesignBar from "./DesignBar.jsx";
import PlaybackBar from "./PlaybackBar.jsx";
import CanvasStage from "./CanvasStage.jsx";
import HowToUse from "./HowToUse.jsx";

export default function StudioLayout() {
  const { dims } = useStudio();
  return (
    <div className="max-w-5xl mx-auto p-5 text-neutral-900 select-none" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <header className="mb-4 flex items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Little Grid Company</h1>
        <span className="font-mono text-xs text-neutral-400">{dims.w}×{dims.h}</span>
      </header>

      <div className="flex flex-col lg:flex-row gap-5">
        <div className="w-full lg:w-80 space-y-5">
          <ColorPicker />
          <PalettePanel />
          <LayersPanel />
          <LayerEditor />
        </div>

        <div className="w-full lg:flex-1 space-y-3">
          <CanvasToolbar />
          <DesignBar />
          <PlaybackBar />
          <CanvasStage />
          <HowToUse />
        </div>
      </div>
    </div>
  );
}
