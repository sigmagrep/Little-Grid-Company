import React from "react";
import { useStudio } from "../studio/StudioContext.jsx";

export default function CanvasStage() {
  const { containerRef, canvasRef, onPointerDown, onPointerMove, endDrag, onPointerLeave } = useStudio();
  return (
    <>
          <div className="rounded-xl border border-neutral-200 bg-neutral-100 p-4 flex items-center justify-center" style={{ minHeight: "260px" }}>
            <div ref={containerRef} className="w-full flex items-center justify-center">
              <canvas ref={canvasRef}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onPointerLeave={onPointerLeave}
                className="bg-white shadow-sm" style={{ touchAction: "none", cursor: "crosshair", imageRendering: "pixelated" }} />
            </div>
          </div>
    </>
  );
}
