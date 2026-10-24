const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const ONE = ethers.parseEther("1");
const DAY = 24 * 60 * 60;

async function deploy() {
  const [creator, alice, bob, stranger] = await ethers.getSigners();
  const crowdfund = await ethers.deployContract("Crowdfund");
  return { crowdfund, creator, alice, bob, stranger };
}

// Deploy + create campaign #0 with goal = 2 ETH, duration = 1 day
async function withCampaign() {
  const base = await deploy();
  await base.crowdfund.connect(base.creator).createCampaign("Solar lamps", 2n * ONE, DAY);
  return base;
}

describe("Crowdfund", () => {
  describe("1. createCampaign", () => {
    it("stores the campaign and emits CampaignCreated", async () => {
      const { crowdfund, creator } = await loadFixture(deploy);
      const tx = await crowdfund.connect(creator).createCampaign("Solar lamps", 2n * ONE, DAY);
      const block = await ethers.provider.getBlock("latest");
      const deadline = BigInt(block.timestamp + DAY);

      await expect(tx)
        .to.emit(crowdfund, "CampaignCreated")
        .withArgs(0, creator.address, "Solar lamps", 2n * ONE, deadline);

      const c = await crowdfund.getCampaign(0);
      expect(c.creator).to.equal(creator.address);
      expect(c.title).to.equal("Solar lamps");
      expect(c.goal).to.equal(2n * ONE);
      expect(c.deadline).to.equal(deadline);
      expect(c.raised).to.equal(0);
      expect(c.withdrawn).to.equal(false);
      expect(await crowdfund.campaignCount()).to.equal(1);
    });

    it("rejects empty title, zero goal and zero duration", async () => {
      const { crowdfund } = await loadFixture(deploy);
      await expect(crowdfund.createCampaign("", ONE, DAY)).to.be.revertedWith("Title required");
      await expect(crowdfund.createCampaign("x", 0, DAY)).to.be.revertedWith("Goal must be > 0");
      await expect(crowdfund.createCampaign("x", ONE, 0)).to.be.revertedWith("Duration must be > 0");
    });

    it("reverts when reading a campaign that does not exist", async () => {
      const { crowdfund } = await loadFixture(deploy);
      await expect(crowdfund.getCampaign(0)).to.be.revertedWith("Campaign does not exist");
    });
  });

  describe("2. contribute", () => {
    it("updates totals and emits Contributed", async () => {
      const { crowdfund, alice, bob } = await loadFixture(withCampaign);
      await expect(crowdfund.connect(alice).contribute(0, { value: ONE }))
        .to.emit(crowdfund, "Contributed")
        .withArgs(0, alice.address, ONE);
      await crowdfund.connect(bob).contribute(0, { value: ONE / 2n });
      await crowdfund.connect(alice).contribute(0, { value: ONE / 2n });

      expect((await crowdfund.getCampaign(0)).raised).to.equal(2n * ONE);
      expect(await crowdfund.contributionOf(0, alice.address)).to.equal(ONE + ONE / 2n);
      expect(await crowdfund.contributionOf(0, bob.address)).to.equal(ONE / 2n);
      expect(await ethers.provider.getBalance(await crowdfund.getAddress())).to.equal(2n * ONE);
    });

    it("rejects zero value", async () => {
      const { crowdfund, alice } = await loadFixture(withCampaign);
      await expect(crowdfund.connect(alice).contribute(0, { value: 0 })).to.be.revertedWith("Send some ETH");
    });

    it("rejects contributions after the deadline", async () => {
      const { crowdfund, alice } = await loadFixture(withCampaign);
      await time.increase(DAY + 1);
      await expect(crowdfund.connect(alice).contribute(0, { value: ONE })).to.be.revertedWith("Campaign ended");
    });

    it("rejects an unknown campaign id", async () => {
      const { crowdfund, alice } = await loadFixture(withCampaign);
      await expect(crowdfund.connect(alice).contribute(5, { value: ONE })).to.be.revertedWith(
        "Campaign does not exist"
      );
    });
  });

  describe("3. withdraw (goal met)", () => {
    async function funded() {
      const base = await withCampaign();
      await base.crowdfund.connect(base.alice).contribute(0, { value: ONE });
      await base.crowdfund.connect(base.bob).contribute(0, { value: ONE + ONE / 2n }); // 2.5 ETH total (over-funded)
      return base;
    }

    it("pays the creator exactly what was raised and emits Withdrawn", async () => {
      const { crowdfund, creator } = await loadFixture(funded);
      await time.increase(DAY + 1);
      const raised = 5n * ONE / 2n;

      await expect(crowdfund.connect(creator).withdraw(0)).to.changeEtherBalances(
        [creator, crowdfund],
        [raised, -raised]
      );
      expect((await crowdfund.getCampaign(0)).withdrawn).to.equal(true);
    });

    it("emits Withdrawn", async () => {
      const { crowdfund, creator } = await loadFixture(funded);
      await time.increase(DAY + 1);
      await expect(crowdfund.connect(creator).withdraw(0))
        .to.emit(crowdfund, "Withdrawn")
        .withArgs(0, creator.address, (5n * ONE) / 2n);
    });

    it("cannot be called twice", async () => {
      const { crowdfund, creator } = await loadFixture(funded);
      await time.increase(DAY + 1);
      await crowdfund.connect(creator).withdraw(0);
      await expect(crowdfund.connect(creator).withdraw(0)).to.be.revertedWith("Already withdrawn");
    });

    it("rejects anyone but the creator", async () => {
      const { crowdfund, alice } = await loadFixture(funded);
      await time.increase(DAY + 1);
      await expect(crowdfund.connect(alice).withdraw(0)).to.be.revertedWith("Only creator");
    });

    it("rejects withdrawing before the deadline", async () => {
      const { crowdfund, creator } = await loadFixture(funded);
      await expect(crowdfund.connect(creator).withdraw(0)).to.be.revertedWith("Campaign still running");
    });

    it("rejects withdrawing when the goal was not reached", async () => {
      const { crowdfund, creator, alice } = await loadFixture(withCampaign);
      await crowdfund.connect(alice).contribute(0, { value: ONE });
      await time.increase(DAY + 1);
      await expect(crowdfund.connect(creator).withdraw(0)).to.be.revertedWith("Goal not reached");
    });

    it("backers cannot refund a successful campaign", async () => {
      const { crowdfund, alice } = await loadFixture(funded);
      await time.increase(DAY + 1);
      await expect(crowdfund.connect(alice).refund(0)).to.be.revertedWith("Goal was reached");
    });
  });

  describe("4. refund (goal missed)", () => {
    async function underfunded() {
      const base = await withCampaign();
      await base.crowdfund.connect(base.alice).contribute(0, { value: ONE });
      await base.crowdfund.connect(base.bob).contribute(0, { value: ONE / 4n }); // 1.25 ETH of 2
      return base;
    }

    it("returns each backer exactly their own amount and emits Refunded", async () => {
      const { crowdfund, alice, bob } = await loadFixture(underfunded);
      await time.increase(DAY + 1);

      await expect(crowdfund.connect(alice).refund(0))
        .to.emit(crowdfund, "Refunded")
        .withArgs(0, alice.address, ONE);
      await expect(crowdfund.connect(bob).refund(0)).to.changeEtherBalances(
        [bob, crowdfund],
        [ONE / 4n, -(ONE / 4n)]
      );
      expect(await ethers.provider.getBalance(await crowdfund.getAddress())).to.equal(0);
      expect(await crowdfund.contributionOf(0, alice.address)).to.equal(0);
    });

    it("cannot be claimed twice", async () => {
      const { crowdfund, alice } = await loadFixture(underfunded);
      await time.increase(DAY + 1);
      await crowdfund.connect(alice).refund(0);
      await expect(crowdfund.connect(alice).refund(0)).to.be.revertedWith("Nothing to refund");
    });

    it("rejects refunds before the deadline", async () => {
      const { crowdfund, alice } = await loadFixture(underfunded);
      await expect(crowdfund.connect(alice).refund(0)).to.be.revertedWith("Campaign still running");
    });

    it("rejects someone who never contributed", async () => {
      const { crowdfund, stranger } = await loadFixture(underfunded);
      await time.increase(DAY + 1);
      await expect(crowdfund.connect(stranger).refund(0)).to.be.revertedWith("Nothing to refund");
    });
  });

  describe("5. reentrancy", () => {
    it("a malicious backer cannot drain other backers' money via refund()", async () => {
      const { crowdfund, alice } = await loadFixture(withCampaign);
      const crowdfundAddr = await crowdfund.getAddress();

      // An honest backer puts in 1 ETH, the attacker puts in 0.5 ETH. Goal (2 ETH) is missed.
      await crowdfund.connect(alice).contribute(0, { value: ONE });
      const attacker = await ethers.deployContract("ReentrancyAttacker", [crowdfundAddr, 0]);
      await attacker.fund({ value: ONE / 2n });
      await time.increase(DAY + 1);

      await attacker.attack();

      // Attacker tried to re-enter, but only got its own 0.5 ETH back.
      expect(await attacker.reentryAttempts()).to.be.greaterThan(0);
      expect(await attacker.reentrySucceeded()).to.equal(false);
      expect(await ethers.provider.getBalance(await attacker.getAddress())).to.equal(ONE / 2n);
      // Alice's 1 ETH is still safely in the contract and still refundable.
      expect(await ethers.provider.getBalance(crowdfundAddr)).to.equal(ONE);
      await expect(crowdfund.connect(alice).refund(0)).to.changeEtherBalance(alice, ONE);
    });
  });

  describe("6. multiple campaigns are independent", () => {
    it("keeps money, deadlines and outcomes separate", async () => {
      const { crowdfund, creator, alice, bob } = await loadFixture(deploy);
      await crowdfund.connect(creator).createCampaign("A (will succeed)", ONE, DAY);
      await crowdfund.connect(creator).createCampaign("B (will fail)", 10n * ONE, 2 * DAY);

      await crowdfund.connect(alice).contribute(0, { value: ONE });
      await crowdfund.connect(bob).contribute(1, { value: ONE });

      await time.increase(DAY + 1);

      // Campaign A is over and funded; campaign B is still running.
      await crowdfund.connect(creator).withdraw(0);
      await expect(crowdfund.connect(bob).refund(1)).to.be.revertedWith("Campaign still running");

      await time.increase(DAY);
      // Now B is over and failed: Bob refunds; Alice cannot touch campaign B.
      await expect(crowdfund.connect(bob).refund(1)).to.changeEtherBalance(bob, ONE);
      await expect(crowdfund.connect(alice).refund(1)).to.be.revertedWith("Nothing to refund");
      expect(await crowdfund.campaignCount()).to.equal(2);
    });
  });
});
