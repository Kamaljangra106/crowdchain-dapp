// Deploys Crowdfund and writes its address + ABI where the frontend can read them.
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Network:  ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const crowdfund = await hre.ethers.deployContract("Crowdfund");
  await crowdfund.waitForDeployment();
  const address = await crowdfund.getAddress();
  console.log(`Crowdfund deployed to: ${address}`);

  // Write for the frontend: frontend/src/contract/<network>.json + shared ABI
  const outDir = path.join(__dirname, "..", "frontend", "src", "contract");
  fs.mkdirSync(outDir, { recursive: true });

  const artifact = await hre.artifacts.readArtifact("Crowdfund");
  fs.writeFileSync(path.join(outDir, "abi.json"), JSON.stringify(artifact.abi, null, 2));

  if (hre.network.name === "hardhat") {
    // In-process network disappears when this script exits, so never record its address.
    console.log("(in-process 'hardhat' network: address not saved. Use --network localhost or sepolia)");
    return;
  }

  const addrFile = path.join(outDir, "addresses.json");
  const addresses = fs.existsSync(addrFile) ? JSON.parse(fs.readFileSync(addrFile, "utf8")) : {};
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  addresses[chainId] = address;
  fs.writeFileSync(addrFile, JSON.stringify(addresses, null, 2));
  console.log(`Saved ABI and address (chain ${chainId}) to frontend/src/contract/`);

  if (hre.network.name === "sepolia") {
    console.log("\nTo verify on Etherscan (optional, needs ETHERSCAN_API_KEY):");
    console.log(`  npx hardhat verify --network sepolia ${address}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
