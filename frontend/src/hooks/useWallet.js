import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider, getAddress } from "ethers";
import { CHAINS } from "../lib/chains";
import { explainError } from "../lib/format";

/**
 * Talks to MetaMask (window.ethereum, the EIP-1193 provider it injects).
 * Keeps `account` and `chainId` in sync when the user switches in the extension.
 */
export function useWallet() {
  const injected = typeof window !== "undefined" ? window.ethereum : undefined;
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  // "any" = don't freeze the network at creation time; we handle chain changes ourselves.
  const provider = useMemo(() => (injected ? new BrowserProvider(injected, "any") : null), [injected]);

  useEffect(() => {
    if (!injected) return;
    let cancelled = false;

    // Silent restore: eth_accounts never opens a popup, it only returns already-approved accounts.
    (async () => {
      try {
        const [accounts, cid] = await Promise.all([
          injected.request({ method: "eth_accounts" }),
          injected.request({ method: "eth_chainId" }),
        ]);
        if (cancelled) return;
        setAccount(accounts[0] ? getAddress(accounts[0]) : null);
        setChainId(parseInt(cid, 16));
      } catch (e) {
        if (!cancelled) setError(explainError(e));
      }
    })();

    const onAccounts = (accounts) => setAccount(accounts[0] ? getAddress(accounts[0]) : null);
    const onChain = (hex) => setChainId(parseInt(hex, 16));
    injected.on?.("accountsChanged", onAccounts);
    injected.on?.("chainChanged", onChain);
    return () => {
      cancelled = true;
      injected.removeListener?.("accountsChanged", onAccounts);
      injected.removeListener?.("chainChanged", onChain);
    };
  }, [injected]);

  const connect = useCallback(async () => {
    if (!injected) return;
    setConnecting(true);
    setError(null);
    try {
      const accounts = await injected.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0] ? getAddress(accounts[0]) : null);
    } catch (e) {
      setError(explainError(e));
    } finally {
      setConnecting(false);
    }
  }, [injected]);

  const switchChain = useCallback(
    async (id) => {
      const chain = CHAINS[id];
      if (!injected || !chain) return;
      setError(null);
      try {
        await injected.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chain.hexId }] });
      } catch (e) {
        // 4902 = MetaMask doesn't know this chain yet (e.g. the local Hardhat node). Offer to add it.
        if ((e?.code === 4902 || e?.data?.originalError?.code === 4902) && chain.addParams) {
          try {
            await injected.request({ method: "wallet_addEthereumChain", params: [chain.addParams] });
          } catch (e2) {
            setError(explainError(e2));
          }
        } else {
          setError(explainError(e));
        }
      }
    },
    [injected]
  );

  return { hasWallet: !!injected, provider, account, chainId, connecting, error, connect, switchChain };
}
