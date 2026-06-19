import React from "react";
import { useStudio } from "../studio/StudioContext.jsx";

export default function PlaybackBar() {
  const { togglePlay, isPlaying, fps, setFps, clamp, frameInfo } = useStudio();
  return (
    <>
          <div className="flex items-center gap-3 flex-wrap rounded-lg border border-neutral-200 bg-white px-3 py-2">
            <button onClick={togglePlay} title={isPlaying ? "Pause preview" : "Play preview"}
              className={"px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors " + (isPlaying ? "bg-indigo-600 text-white hover:bg-indigo-500" : "bg-neutral-900 text-white hover:bg-neutral-700")}>
              {isPlaying ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              )}
              {isPlaying ? "Pause" : "Play"}
            </button>
            <label className="flex items-center gap-1.5 text-xs text-neutral-600">
              <span className="uppercase tracking-wide">FPS</span>
              <input type="number" min="1" max="60" value={fps} onChange={(e) => setFps(clamp(parseInt(e.target.value, 10) || 1, 1, 60))}
                className="w-16 px-2 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-neutral-800 focus:outline-none focus:border-neutral-500" />
            </label>
            <span className="font-mono text-xs text-neutral-500">Frame {frameInfo.i + 1} / {frameInfo.n}</span>
            {isPlaying ? (
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-indigo-600"><span className="w-2 h-2 rounded-full bg-indigo-500" />Preview — editing paused</span>
            ) : frameInfo.n > 1 ? (
              <span className="ml-auto text-xs text-neutral-500">{frameInfo.n}-frame loop ready</span>
            ) : (
              <span className="ml-auto text-xs text-neutral-400">Single still frame — add an effect layer to animate.</span>
            )}
          </div>
    </>
  );
}
