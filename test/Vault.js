const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RewardsVault", function () {
  let communityToken;
  let rewardsVault;
  let owner;
  let treasurer;
  let addr1;
  let addr2;

  // Define constant roles from the contracts for easy use in tests
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const TREASURER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TREASURER_ROLE"));
  const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));
  const AUDITOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AUDITOR_ROLE"));


  beforeEach(async function () {
    [owner, treasurer, addr1, addr2] = await ethers.getSigners();

    // Deploy the CommunityToken contract
    const CommunityToken = await ethers.getContractFactory("CommunityToken");
    communityToken = await CommunityToken.deploy("CommunityToken", "CMT", owner.address);
    await communityToken.waitForDeployment();

    // Deploy the RewardsVault contract
    const RewardsVault = await ethers.getContractFactory("RewardsVault");
    rewardsVault = await RewardsVault.deploy(await communityToken.getAddress(), owner.address, treasurer.address);
    await rewardsVault.waitForDeployment();

    // Manually grant the MINTER_ROLE on the CommunityToken to the RewardsVault
    // This replicates the manual deployment step required after our previous discussion
    await communityToken.grantRole(MINTER_ROLE, await rewardsVault.getAddress());
  });

  describe("Deployment", function () {
    it("Should set the correct token address", async function () {
      // Fix: The token variable in RewardsVault needs to be public for this test to work.
      // If it's private, you need a getter function.
      expect(await rewardsVault.token()).to.equal(await communityToken.getAddress());
    });

    it("Should set the correct foundation wallet address", async function () {
      expect(await rewardsVault.foundationWallet()).to.equal(treasurer.address);
    });

    it("Should grant the DEFAULT_ADMIN_ROLE to the deployer", async function () {
      expect(await rewardsVault.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should grant the TREASURER_ROLE to the deployer", async function () {
      expect(await rewardsVault.hasRole(TREASURER_ROLE, owner.address)).to.be.true;
    });

    it("Should grant the PAUSER_ROLE to the deployer", async function () {
      expect(await rewardsVault.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
    });

    it("Should grant the AUDITOR_ROLE to the deployer", async function () {
      expect(await rewardsVault.hasRole(AUDITOR_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Functionality", function () {
    it("Should allow a donation and mint the correct amount of tokens", async function () {
      const donationAmount = ethers.parseEther("1");
      const expectedTokens = 100n; // 1 ETH * RATE (100) / 1e18 = 100 tokens (raw number, not wei)

      const donateTx = await rewardsVault.connect(addr1).donate({ value: donationAmount });

      // Wait for the transaction to be mined
      await donateTx.wait();

      // Check that addr1 received the correct amount of tokens
      expect(await communityToken.balanceOf(addr1.address)).to.equal(expectedTokens);
    });

    it("Should allow the treasurer to withdraw funds", async function () {
      const donationAmount = ethers.parseEther("1");
      await rewardsVault.connect(addr1).donate({ value: donationAmount });

      const initialVaultBalance = await ethers.provider.getBalance(await rewardsVault.getAddress());
      const initialTreasurerBalance = await ethers.provider.getBalance(treasurer.address);
      const withdrawAmount = ethers.parseEther("0.5");

      // Withdraw funds and get transaction details
      const tx = await rewardsVault.connect(owner).withdraw(withdrawAmount);
      const receipt = await tx.wait();

      const finalVaultBalance = await ethers.provider.getBalance(await rewardsVault.getAddress());
      const finalTreasurerBalance = await ethers.provider.getBalance(treasurer.address);

      // Check balances after withdrawal
      expect(finalVaultBalance).to.equal(initialVaultBalance - withdrawAmount);
      expect(finalTreasurerBalance).to.equal(initialTreasurerBalance + withdrawAmount);
    });

    it("Should not allow a non-treasurer to withdraw funds", async function () {
      const withdrawAmount = ethers.parseEther("0.5");
      await expect(rewardsVault.connect(addr2).withdraw(withdrawAmount)).to.be.revertedWithCustomError(
        rewardsVault,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("Should allow the admin to change the foundation wallet", async function () {
      const newWallet = addr2.address;
      await rewardsVault.connect(owner).setFoundationWallet(newWallet);
      expect(await rewardsVault.foundationWallet()).to.equal(newWallet);
    });

    it("Should not allow a non-admin to change the foundation wallet", async function () {
      const newWallet = addr2.address;
      await expect(rewardsVault.connect(addr1).setFoundationWallet(newWallet)).to.be.revertedWithCustomError(
        rewardsVault,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("Should pause and unpause the contract", async function () {
      // Pause the contract
      await rewardsVault.connect(owner).pause();
      expect(await rewardsVault.paused()).to.be.true;

      // Attempt to donate while paused
      await expect(rewardsVault.connect(addr1).donate({ value: ethers.parseEther("0.1") })).to.be.revertedWithCustomError(
        rewardsVault,
        "EnforcedPause"
      );

      // Unpause the contract
      await rewardsVault.connect(owner).unpause();
      expect(await rewardsVault.paused()).to.be.false;

      // Donate successfully after unpausing
      const donationAmount = ethers.parseEther("0.1");
      const expectedTokens = 10n; // 0.1 ETH * RATE (100) / 1e18 = 10 tokens (raw number)
      await rewardsVault.connect(addr1).donate({ value: donationAmount });
      expect(await communityToken.balanceOf(addr1.address)).to.equal(expectedTokens);
    });

    it("Should not accept direct ETH transfers", async function () {
      await expect(owner.sendTransaction({
        to: await rewardsVault.getAddress(),
        value: ethers.parseEther("1"),
      })).to.be.revertedWithCustomError(
        rewardsVault,
        "DirectETHNotAllowed"
      );
    });
  });
});