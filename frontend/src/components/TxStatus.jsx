import { CHAINS } from "../lib/chains";
import { shortAddr } from "../lib/format";

/**
 * One message that follows a transaction: MetaMask prompt -> sent to the network -> done or failed.
 * The wording comes from the caller so the button, the progress text and the result all use the same verb.
 */
export default function TxStatus({ tx, chainId, onDismiss }) {
  if (!tx) return null;
  const base = CHAINS[chainId]?.explorerTx;
  const heading = {
    wallet: `${tx.doing}. Confirm in MetaMask.`,
    pending: `${tx.doing}…`,
    ok: tx.done,
    error: "That didn't go through",
  }[tx.state];

  return (
    <div className={`toast ${tx.state}`} role="status" aria-live="polite">
      <div>
        <p className="toast-title">{heading}</p>
        {tx.state === "error" && <p>{tx.message}</p>}
        {tx.state === "pending" && <p>Waiting for the block to be confirmed.</p>}
        {tx.hash &&
          (base ? (
            <p>
              <a href={base + tx.hash} target="_blank" rel="noreferrer">
                View transaction on Etherscan
              </a>
            </p>
          ) : (
            <p>Transaction {shortAddr(tx.hash)}</p>
          ))}
      </div>
      {(tx.state === "ok" || tx.state === "error") && (
        <button className="toast-close" onClick={onDismiss} aria-label="Dismiss message">
          Close
        </button>
      )}
    </div>
  );
}
