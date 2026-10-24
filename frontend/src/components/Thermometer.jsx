import { useEffect, useState } from "react";

/**
 * The fundraising thermometer: the mercury climbs toward the goal at the top of the tube.
 * It starts empty and rises once on first render; after that it eases to any new level.
 * `status` picks the mercury colour: active (red), funded (green), failed (grey, drained).
 */
export default function Thermometer({ pct, status, label }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(frame);
  }, [pct]);

  return (
    <div className={`thermo ${status}`} role="img" aria-label={label}>
      <div className="tube">
        <div className="mercury" style={{ "--p": shown / 100 }} />
      </div>
      <div className="bulb" />
    </div>
  );
}
