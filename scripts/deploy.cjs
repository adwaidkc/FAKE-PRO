const hre = require("hardhat");

async function main() {
  console.log("Deploying TrustChain...");

  const TrustChain = await hre.ethers.getContractFactory("TrustChain");

  const contract = await TrustChain.deploy();

  await contract.waitForDeployment();

  console.log("✅ TrustChain deployed to:");
  console.log(await contract.getAddress());
}

main().catch((error) => {
  console.error("❌ DEPLOY FAILED:", error);
  process.exit(1);
});

