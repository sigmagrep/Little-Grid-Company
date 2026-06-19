// Shared className helpers for the effect-parameter forms.
export const dirBtnCls = (active) =>
  "w-8 h-8 rounded border flex items-center justify-center text-sm " +
  (active
    ? "ring-2 ring-indigo-500 border-indigo-500 text-indigo-700 bg-white"
    : "border-neutral-300 text-neutral-600 bg-white hover:bg-neutral-100");

export const twoBtn = (active) =>
  "px-2 py-1 rounded-md border text-xs font-medium " +
  (active
    ? "ring-2 ring-indigo-500 border-indigo-500 text-indigo-700 bg-white"
    : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100");
