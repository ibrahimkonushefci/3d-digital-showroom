import { create } from "zustand";
/** Counts captures so an update cannot reload the app halfway through export. */
export const useCaptureBusy = create<{ count: number }>(() => ({ count: 0 }));
export function beginCapture() {
  useCaptureBusy.setState((s) => ({ count: s.count + 1 }));
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    useCaptureBusy.setState((s) => ({ count: Math.max(0, s.count - 1) }));
  };
}
