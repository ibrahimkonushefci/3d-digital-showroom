import { useEffect, useState } from "react";
/**
 * The few millimetres between fronts are a deep, shaded slot in reality.
 * A dark plane just behind the fronts makes closed gaps read dark instead of
 * showing lit carcass edges. It disappears as soon as anything opens and
 * returns only after closing has settled, so it never covers an interior.
 */
export function GapShade({
  w,
  h,
  d,
  closed,
}: {
  w: number;
  h: number;
  d: number;
  closed: boolean;
}) {
  // Hidden in the same render that opens anything: hiding it from an effect
  // left one or more frames (more while start-up work was running) showing
  // this dark plane where the fronts had been, a black flash.
  const [settled, setSettled] = useState(closed);
  useEffect(() => {
    if (!closed) {
      setSettled(false);
      return;
    }
    const timer = setTimeout(() => setSettled(true), 900);
    return () => clearTimeout(timer);
  }, [closed]);
  return closed && settled ? (
    <mesh position={[0, h / 2, d / 2 + 0.0012]} raycast={() => {}}>
      <planeGeometry args={[w - 0.002, h - 0.002]} />
      <meshStandardMaterial color="#14120f" roughness={1} />
    </mesh>
  ) : null;
}
