import { useState } from "react";
import { parseEther } from "ethers";
import { countdown, eth, shortAddr } from "../lib/format";
import Thermometer from "./Thermometer";

export default function CampaignCard({ c, now, account, canTransact, busy, onContribute, onWithdraw, onRefund }) {
  const [amount, setAmount] = useState("");

  const ended = now >= c.deadline;
  const funded = c.raised >= c.goal;
  const status = !ended ? "active" : funded ? "funded" : "failed";
  const rawPct = c.goal === 0n ? 0 : Number((c.raised * 10000n) / c.goal) / 100;
  const fillPct = Math.min(100, rawPct);
  const isCreator = !!account && c.creator.toLowerCase() === account.toLowerCase();

  let amountWei = null;
  try {
    if (amount.trim()) amountWei = parseEther(amount.trim());
  } catch {
    amountWei = null;
  }
  const amountOk = !!amountWei && amountWei > 0n;

  const canWithdraw = isCreator && ended && funded && !c.withdrawn;
  const canRefund = ended && !funded && c.mine > 0n;
  const outcome = c.withdrawn ? "Paid out" : funded ? "Funded" : "Missed";

  return (
    <article className={`row ${status}`}>
      <Thermometer
        pct={fillPct}
        status={status}
        label={`${Math.floor(rawPct)}% of the ${eth(c.goal)} ETH goal raised`}
      />

      <div className="row-body">
        <header>
          <h3>{c.title}</h3>
          <p className="by">
            Campaign {c.id}, started by {isCreator ? "you" : shortAddr(c.creator)}
          </p>
        </header>

        <div className="figures">
          <div>
            <p className="big">
              <span className="num">{eth(c.raised)}</span> <span className="unit">ETH raised</span>
            </p>
            <p className="of">
              {Math.floor(rawPct)}% of the {eth(c.goal)} ETH goal
            </p>
          </div>
          <div className="clock">
            {status === "active" ? (
              <>
                <p className="num small">{countdown(c.deadline - now)}</p>
                <p className="of">left to pledge</p>
              </>
            ) : (
              <>
                <p className={`num small outcome ${status}`}>{outcome}</p>
                <p className="of">deadline passed</p>
              </>
            )}
          </div>
        </div>

        {c.mine > 0n && <p className="mine">Your pledge: {eth(c.mine)} ETH</p>}

        {status === "active" && (
          <form
            className="pledge"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!amountOk) return;
              if (await onContribute(c.id, amountWei)) setAmount("");
            }}
          >
            <input
              inputMode="decimal"
              placeholder="Amount in ETH"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label={`Amount to contribute to ${c.title}, in ETH`}
              aria-invalid={amount.trim() !== "" && !amountOk}
            />
            <button className="pledge-btn" disabled={!canTransact || busy || !amountOk}>
              Contribute
            </button>
          </form>
        )}

        {canWithdraw && (
          <button className="solid" disabled={!canTransact || busy} onClick={() => onWithdraw(c.id)}>
            Withdraw {eth(c.raised)} ETH
          </button>
        )}
        {canRefund && (
          <button className="outline" disabled={!canTransact || busy} onClick={() => onRefund(c.id)}>
            Refund my {eth(c.mine)} ETH
          </button>
        )}

        {ended && funded && c.withdrawn && (
          <p className="note">
            {isCreator ? "You withdrew the funds." : "Goal reached. The creator withdrew the funds."}
          </p>
        )}
        {ended && funded && !c.withdrawn && !isCreator && (
          <p className="note">Goal reached. The creator can now withdraw.</p>
        )}
        {ended && funded && !c.withdrawn && isCreator && !canWithdraw && (
          <p className="note">Goal reached. Connect your wallet to withdraw.</p>
        )}
        {ended && !funded && c.mine === 0n && (
          <p className="note">Goal missed. Anyone who pledged can refund themselves.</p>
        )}
      </div>
    </article>
  );
}
