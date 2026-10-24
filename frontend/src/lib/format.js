import { formatEther } from "ethers";

export function shortAddr(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

/** 1.5 ETH -> "1.5", trims trailing zeros, caps at 4 decimals for display */
export function eth(wei) {
  const n = Number(formatEther(wei));
  if (n === 0) return "0";
  if (n < 0.0001) return "<0.0001";
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** 105 -> "1m 45s". The caller adds the word "left". */
export function countdown(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Turn an ethers/MetaMask error into one readable sentence. */
export function explainError(err) {
  if (err?.code === "ACTION_REJECTED" || err?.code === 4001) return "You rejected the request in MetaMask.";
  const reason = err?.reason || err?.revert?.args?.[0];
  if (reason) return reason;
  const nested = err?.info?.error?.message || err?.error?.message || err?.data?.message;
  const msg = nested || err?.shortMessage || err?.message || "Something went wrong.";
  const m = msg.match(/reverted with reason string '([^']+)'/);
  return m ? m[1] : msg;
}
