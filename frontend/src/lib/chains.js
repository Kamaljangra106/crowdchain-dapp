import addresses from "../contract/addresses.json";

// Networks this app knows how to talk to. The contract address for each one is
// written into addresses.json by `scripts/deploy.js`.
export const CHAINS = {
  31337: {
    name: "Hardhat Local",
    hexId: "0x7a69",
    addParams: {
      chainId: "0x7a69",
      chainName: "Hardhat Local",
      rpcUrls: ["http://127.0.0.1:8545"],
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    },
    explorerTx: null,
  },
  11155111: {
    name: "Sepolia",
    hexId: "0xaa36a7",
    addParams: null, // built into MetaMask
    explorerTx: "https://sepolia.etherscan.io/tx/",
  },
};

export function contractAddressFor(chainId) {
  return addresses[String(chainId)] || null;
}

export function deployedChainIds() {
  return Object.keys(addresses).map(Number);
}
