import { useCallback, useEffect, useRef, useState } from "react";
import { Contract } from "ethers";
import abi from "../contract/abi.json";
import { contractAddressFor } from "../lib/chains";
import { explainError } from "../lib/format";

const EVENTS = ["CampaignCreated", "Contributed", "Withdrawn", "Refunded"];

/**
 * Loads every campaign (plus the connected user's contribution to each) and keeps
 * the list fresh: it reloads on contract events and every 10 seconds as a fallback.
 * Also tracks the chain's clock, because deadlines are compared to block.timestamp,
 * which can differ from the browser clock (especially on a local Hardhat node).
 */
export function useCampaigns({ provider, account, chainId }) {
  const address = chainId ? contractAddressFor(chainId) : null;
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const clockOffset = useRef(0); // chainTime - browserTime, in seconds
  const requestId = useRef(0);

  const chainNow = useCallback(() => Math.floor(Date.now() / 1000) + clockOffset.current, []);

  const refresh = useCallback(async () => {
    const thisRequest = ++requestId.current;
    if (!provider || !address) {
      setCampaigns([]);
      setLoading(false);
      return;
    }
    try {
      const code = await provider.getCode(address);
      if (code === "0x") {
        throw new Error("No contract found at the saved address on this network. Is your local node running and the contract deployed?");
      }
      const contract = new Contract(address, abi, provider);
      const count = Number(await contract.campaignCount());
      const block = await provider.getBlock("latest");
      const items = await Promise.all(
        [...Array(count).keys()].map(async (id) => {
          const [c, mine] = await Promise.all([
            contract.getCampaign(id),
            account ? contract.contributionOf(id, account) : Promise.resolve(0n),
          ]);
          return {
            id,
            creator: c.creator,
            title: c.title,
            goal: c.goal,
            deadline: Number(c.deadline),
            raised: c.raised,
            withdrawn: c.withdrawn,
            mine,
          };
        })
      );
      if (thisRequest !== requestId.current) return; // a newer refresh superseded this one
      clockOffset.current = block.timestamp - Math.floor(Date.now() / 1000);
      setCampaigns(items.reverse()); // newest first
      setError(null);
    } catch (e) {
      if (thisRequest === requestId.current) setError(explainError(e));
    } finally {
      if (thisRequest === requestId.current) setLoading(false);
    }
  }, [provider, address, account]);

  useEffect(() => {
    setLoading(true);
    refresh();
    const timer = setInterval(refresh, 10_000);
    return () => clearInterval(timer);
  }, [refresh]);

  // Live updates: reload whenever the contract emits one of its events.
  useEffect(() => {
    if (!provider || !address) return;
    const contract = new Contract(address, abi, provider);
    const handler = () => refresh();
    EVENTS.forEach((name) => contract.on(name, handler));
    return () => {
      EVENTS.forEach((name) => contract.off(name, handler));
    };
  }, [provider, address, refresh]);

  return { address, campaigns, loading, error, refresh, chainNow };
}
