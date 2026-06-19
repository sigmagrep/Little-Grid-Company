import React from "react";
import { dirBtnCls } from "./effectStyles.js";

const DIRS = [["NW", "↖"], ["N", "↑"], ["NE", "↗"], ["W", "←"], [null, ""], ["E", "→"], ["SW", "↙"], ["S", "↓"], ["SE", "↘"]];

// 8-way compass selector. `value` is the active direction; `onChange(dir)` fires on click.
export default function DirectionGrid({ value, onChange }) {
  return (
    <div className="inline-grid grid-cols-3 gap-1">
      {DIRS.map(([dir, glyph], i) =>
        dir ? (
          <button key={i} onClick={() => onChange(dir)} title={dir} className={dirBtnCls(value === dir)}>{glyph}</button>
        ) : (
          <div key={i} className="w-8 h-8 rounded bg-neutral-100" />
        )
      )}
    </div>
  );
}
