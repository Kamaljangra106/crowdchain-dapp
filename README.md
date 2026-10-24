# CrowdChain: Ethereum Crowdfunding dApp

An all-or-nothing crowdfunding app built with a Solidity smart contract, Hardhat, React and MetaMask.

- Anyone can **create a campaign** with a goal (in ETH) and a deadline.
- Anyone can **contribute** ETH before the deadline.
- After the deadline:
  - **Goal reached** → the creator can **withdraw** everything raised.
  - **Goal missed** → every backer can **refund** their own contribution.

> Educational project. Not audited. Use testnets only, never real money.

## Project structure

```
contracts/Crowdfund.sol            The smart contract (all the rules live here)
contracts/test/ReentrancyAttacker.sol  Test-only malicious contract
test/Crowdfund.test.js             20 automated tests
scripts/deploy.js                  Deploys and writes ABI + address for the frontend
hardhat.config.js                  Networks: localhost, sepolia (optional)
frontend/                          React + Vite + ethers.js app (MetaMask)
docs/design.md                     Design doc from planning
```

## How the contract works

| Function | Who | When | What |
|---|---|---|---|
| `createCampaign(title, goal, durationSeconds)` | anyone | any time | Creates a campaign, returns its id, emits `CampaignCreated` |
| `contribute(id)` (payable) | anyone | before deadline | Adds `msg.value` to the campaign and to the sender's balance |
| `withdraw(id)` | creator only | after deadline, goal reached, once | Sends all raised ETH to the creator |
| `refund(id)` | a backer | after deadline, goal missed | Sends that backer's own contribution back |

Safety choices (worth explaining in a viva or report):
- **Checks-effects-interactions:** state is updated (`withdrawn = true`, balance set to `0`) *before* ETH is sent, so a malicious receiver can't re-enter and take money twice.
- **`ReentrancyGuard`** from OpenZeppelin on `withdraw` and `refund` as a second layer.
- **Pull refunds:** each backer claims their own money. The contract never loops over backers sending ETH, so one reverting contract can't block everyone else.
- **Return value checked** on every low-level `call`.
- **No owner or admin.** Nobody can change the rules or take funds after deployment.
- **Events** (`CampaignCreated`, `Contributed`, `Withdrawn`, `Refunded`) let the UI update without polling storage.

## Setup

Requirements: Node.js 20+ and the [MetaMask](https://metamask.io/download/) browser extension.

```bash
npm install
cd frontend && npm install && cd ..
```

### 1. Run the tests

```bash
npm test
```

### 2. Run it locally (fastest way to try everything)

Open three terminals in the project folder.

```bash
# Terminal 1: local blockchain (prints 20 test accounts with 10000 fake ETH each)
npm run node
```

```bash
# Terminal 2: deploy the contract to it
npm run deploy:local
```

```bash
# Terminal 3: start the website at http://localhost:5173
cd frontend && npm run dev
```

**MetaMask setup for local use**
1. Click the network picker → *Add network manually* (or just click **Hardhat Local** in the app's banner and approve):
   RPC `http://127.0.0.1:8545`, chain ID `31337`, symbol `ETH`.
2. *Import account* using one of the private keys printed in Terminal 1. These are public test keys. Never send real funds to them.
3. Import a second account the same way so you can act as creator and backer.

**Demo script (about 3 minutes)**
1. Connect MetaMask, create a campaign: goal `1` ETH, runs for `2` minutes.
2. Contribute from account #1 and from a second account.
3. Wait for the countdown (or fast-forward the local chain, see below).
4. Creator clicks **Withdraw** if the goal was reached. Otherwise backers click **Refund**.

Fast-forward the local chain 5 minutes instead of waiting:

```bash
curl -s -X POST http://127.0.0.1:8545 -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"evm_increaseTime","params":[300]}' \
&& curl -s -X POST http://127.0.0.1:8545 -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"evm_mine","params":[]}'
```

> If you restart `npm run node`, the chain resets. Run `npm run deploy:local` again, and in MetaMask use *Settings → Advanced → Clear activity tab data* for the local account (otherwise MetaMask may show a stale nonce error).

### 3. Deploy to Sepolia testnet (optional)

1. Create a **new throwaway** MetaMask account for testing. Never use a wallet that holds real funds.
2. Get free Sepolia ETH from a faucet (Alchemy, Infura or QuickNode faucets; some require a small mainnet balance or an account).
3. Get a Sepolia RPC URL (a free Alchemy or Infura project).
4. Copy `.env.example` to `.env` and fill in `SEPOLIA_RPC_URL` and `PRIVATE_KEY` (the throwaway account's key). `.env` is git-ignored.
5. Deploy, then restart the frontend:

```bash
npm run deploy:sepolia
cd frontend && npm run dev
```

6. Optional: verify the source on Etherscan (needs `ETHERSCAN_API_KEY` in `.env`):
   `npx hardhat verify --network sepolia <contract address>`

The deploy script saves the address in `frontend/src/contract/addresses.json`, so the app knows which contract to use on each network. Record the Sepolia address and Etherscan link here for your submission:

- Sepolia contract address: _(fill in after deploying)_

## Test coverage

`npm test` runs 20 tests in six groups: campaign creation, contributions, withdrawals (goal met), refunds (goal missed), a reentrancy attack against `refund()`, and several campaigns running independently. Deadlines are tested by moving the test chain's clock forward.

## Ideas for extending it

Milestone-based fund release with backer voting, ERC-721 "backer badge" NFTs, stablecoin campaigns, campaign images on IPFS. The original design discussion is in `docs/design.md`.
