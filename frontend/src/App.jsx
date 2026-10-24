import { useEffect, useState } from "react";
import { Contract } from "ethers";
import abi from "./contract/abi.json";
import { CHAINS, deployedChainIds } from "./lib/chains";
import { eth, explainError, shortAddr } from "./lib/format";
import { useWallet } from "./hooks/useWallet";
import { useCampaigns } from "./hooks/useCampaigns";
import CreateCampaign from "./components/CreateCampaign";
import CampaignCard from "./components/CampaignCard";
import TxStatus from "./components/TxStatus";

function BrandMark() {
  return (
    <svg width="14" height="28" viewBox="0 0 14 28" aria-hidden="true">
      <rect x="4" y="1" width="6" height="17" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="5.5" y="10" width="3" height="10" fill="var(--mercury)" />
      <circle cx="7" cy="21" r="5" fill="var(--mercury)" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export default function App() {
  const wallet = useWallet();
  const { hasWallet, provider, account, chainId } = wallet;
  const { address, campaigns, loading, error, refresh, chainNow } = useCampaigns({ provider, account, chainId });

  // Re-render every second so countdowns and open/ended status stay live.
  const [now, setNow] = useState(chainNow());
  useEffect(() => {
    const t = setInterval(() => setNow(chainNow()), 1000);
    return () => clearInterval(t);
  }, [chainNow]);

  // tx = { state: wallet | pending | ok | error, doing, done, hash?, message? }
  const [tx, setTx] = useState(null);
  const busy = tx?.state === "wallet" || tx?.state === "pending";

  const supported = chainId != null && !!CHAINS[chainId];
  const deployed = supported && !!address;
  const canTransact = !!account && deployed;

  /** Sends one transaction and walks the message through: MetaMask prompt, sent, done or failed. */
  async function runTx(doing, done, send) {
    setTx({ state: "wallet", doing, done });
    try {
      const signer = await provider.getSigner();
      const contract = new Contract(address, abi, signer);
      const response = await send(contract);
      setTx({ state: "pending", doing, done, hash: response.hash });
      await response.wait();
      setTx({ state: "ok", doing, done, hash: response.hash });
      await refresh();
      return true;
    } catch (e) {
      setTx({ state: "error", doing, done, message: explainError(e) });
      return false;
    }
  }

  const create = (title, goalWei, seconds) =>
    runTx(`Creating "${title}"`, `Created "${title}"`, (c) => c.createCampaign(title, goalWei, seconds));
  const contribute = (id, value) =>
    runTx(`Contributing ${eth(value)} ETH`, `Contributed ${eth(value)} ETH`, (c) => c.contribute(id, { value }));
  const withdraw = (id) => runTx("Withdrawing the funds", "Funds withdrawn", (c) => c.withdraw(id));
  const refund = (id) => runTx("Refunding your pledge", "Pledge refunded", (c) => c.refund(id));

  const switchTargets = deployedChainIds().filter((id) => CHAINS[id]);

  return (
    <>
      <header className="topbar">
        <div className="wrap bar">
          <div className="brand">
            <BrandMark /> CrowdChain
          </div>
          <div className="wallet">
            {chainId != null && (
              <span className="net">
                <i className={`dot ${supported ? "ok" : "bad"}`} aria-hidden="true" />
                {CHAINS[chainId]?.name ?? `Unsupported network (${chainId})`}
              </span>
            )}
            {account ? (
              <span className="acct" title={account}>
                {shortAddr(account)}
              </span>
            ) : (
              hasWallet && (
                <button className="solid" onClick={wallet.connect} disabled={wallet.connecting}>
                  {wallet.connecting ? "Connecting…" : "Connect MetaMask"}
                </button>
              )
            )}
          </div>
        </div>
      </header>

      <main className="wrap">
        <section className="hero">
          <h1>Reach the goal by the deadline, or everyone gets their money back.</h1>
          <dl className="outcomes">
            <div className="funded">
              <dt>Goal reached by the deadline</dt>
              <dd>The creator withdraws the ETH.</dd>
            </div>
            <div className="failed">
              <dt>Goal missed</dt>
              <dd>Each backer refunds their own pledge. Nobody else can touch it.</dd>
            </div>
          </dl>
        </section>

        <div className="notices">
          {!hasWallet && (
            <p className="notice">
              MetaMask isn't installed in this browser.{" "}
              <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">
                Install MetaMask
              </a>{" "}
              and reload the page.
            </p>
          )}
          {wallet.error && <p className="notice">{wallet.error}</p>}
          {hasWallet && chainId != null && !supported && (
            <p className="notice">
              This app isn't deployed on network {chainId}.{" "}
              {switchTargets.length > 0 ? "Switch MetaMask to:" : "Deploy the contract first (see README)."}{" "}
              {switchTargets.map((id) => (
                <button key={id} className="link" onClick={() => wallet.switchChain(id)}>
                  {CHAINS[id].name}
                </button>
              ))}
            </p>
          )}
          {supported && !address && (
            <p className="notice">
              No contract is deployed on {CHAINS[chainId].name} yet. Run the deploy script for this network (see
              README).
            </p>
          )}
          {deployed && !account && hasWallet && (
            <p className="notice info">Connect MetaMask to create campaigns and contribute.</p>
          )}
          {deployed && error && <p className="notice">{error}</p>}
        </div>

        <div className="layout">
          <section aria-label="Campaigns">
            <h2 className="section-title">Campaigns</h2>
            {deployed && loading && <p className="empty">Loading campaigns…</p>}
            {deployed && !loading && !error && campaigns.length === 0 && (
              <p className="empty">No campaigns yet. Use the form to start the first one.</p>
            )}
            {campaigns.length > 0 && (
              <div className="board">
                {campaigns.map((c) => (
                  <CampaignCard
                    key={c.id}
                    c={c}
                    now={now}
                    account={account}
                    canTransact={canTransact}
                    busy={busy}
                    onContribute={contribute}
                    onWithdraw={withdraw}
                    onRefund={refund}
                  />
                ))}
              </div>
            )}
          </section>

          <aside>
            <CreateCampaign disabled={!canTransact} busy={busy} onCreate={create} />
            {address && (
              <p className="contract-addr">
                Contract {shortAddr(address)} on {CHAINS[chainId]?.name}
              </p>
            )}
          </aside>
        </div>
      </main>

      <TxStatus tx={tx} chainId={chainId} onDismiss={() => setTx(null)} />
    </>
  );
}
