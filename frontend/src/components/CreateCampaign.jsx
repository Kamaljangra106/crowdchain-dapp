import { useState } from "react";
import { parseEther } from "ethers";

const UNITS = { minutes: 60, hours: 3600, days: 86400 };

export default function CreateCampaign({ disabled, busy, onCreate }) {
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [duration, setDuration] = useState("5");
  const [unit, setUnit] = useState("minutes");

  let goalWei = null;
  try {
    if (goal.trim()) goalWei = parseEther(goal.trim());
  } catch {
    goalWei = null;
  }
  const durationNum = Number(duration);
  const valid = title.trim().length > 0 && goalWei && goalWei > 0n && durationNum > 0 && Number.isFinite(durationNum);

  async function submit(e) {
    e.preventDefault();
    if (!valid) return;
    const ok = await onCreate(title.trim(), goalWei, Math.round(durationNum * UNITS[unit]));
    if (ok) {
      setTitle("");
      setGoal("");
    }
  }

  return (
    <form className="start" onSubmit={submit}>
      <h2>Start a campaign</h2>
      <p className="lede">Set a goal and a deadline. Backers can pledge until the deadline passes.</p>

      <label className="field">
        <span>Title</span>
        <input
          value={title}
          maxLength={80}
          placeholder="Solar lamps for the village school"
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <label className="field">
        <span>Goal in ETH</span>
        <input
          inputMode="decimal"
          value={goal}
          placeholder="1.5"
          onChange={(e) => setGoal(e.target.value)}
          aria-invalid={goal.trim() !== "" && !goalWei}
        />
      </label>

      <fieldset className="field">
        <legend>Runs for</legend>
        <div className="inline">
          <input
            inputMode="decimal"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            aria-label="Duration"
          />
          <select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Duration unit">
            {Object.keys(UNITS).map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
        <small>Use a few minutes when demoing.</small>
      </fieldset>

      <button className="solid wide" type="submit" disabled={disabled || busy || !valid}>
        {busy ? "Waiting for the network…" : "Create campaign"}
      </button>
      {disabled && <p className="note">Connect MetaMask on a supported network to create a campaign.</p>}
    </form>
  );
}
