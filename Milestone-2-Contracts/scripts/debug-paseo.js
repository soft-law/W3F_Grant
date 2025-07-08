// scripts/debug-paseo.js
async function main() {
  console.log("🔍 Debugging Paseo Asset Hub connection...\n");

  try {
    // 1. Verificar provider
    console.log("📡 Testing provider connection...");
    const network = await ethers.provider.getNetwork();
    console.log("✅ Connected to network:", network.name || "Unknown");
    console.log("✅ Chain ID from network:", network.chainId.toString());

    // 2. Verificar cuentas
    console.log("\n👥 Checking accounts...");
    const signers = await ethers.getSigners();
    console.log(`Signers available: ${signers.length}`);

    if (signers.length === 0) {
      throw new Error(
        "❌ No signers available. Check PRIVATE_KEY1 and PRIVATE_KEY2 in .env"
      );
    }

    // 3. Verificar balances
    console.log("\n💰 Checking balances...");
    for (let i = 0; i < Math.min(2, signers.length); i++) {
      const signer = signers[i];
      const balance = await ethers.provider.getBalance(signer.address);

      // Usar la API correcta para ethers v6
      const balanceInEth = ethers.formatEther
        ? ethers.formatEther(balance)
        : ethers.utils.formatEther(balance);

      console.log(`Account ${i}: ${signer.address}`);
      console.log(`Balance: ${balanceInEth} PAS`);

      if (balance == 0) {
        console.warn(`⚠️  Account ${i} has zero balance!`);
      }
    }

    // 4. Verificar gas price
    console.log("\n⛽ Checking gas settings...");
    try {
      const gasPrice = await ethers.provider.getGasPrice();
      const gasPriceFormatted = ethers.formatUnits
        ? ethers.formatUnits(gasPrice, "gwei")
        : ethers.utils.formatUnits(gasPrice, "gwei");
      console.log("✅ Gas Price:", gasPriceFormatted, "gwei");
    } catch (error) {
      console.warn("⚠️  Could not get gas price:", error.message);
    }

    // 5. Test simple transaction (get nonce)
    console.log("\n🔢 Testing account nonce...");
    const [owner] = signers;
    const nonce = await ethers.provider.getTransactionCount(owner.address);
    console.log("✅ Account nonce:", nonce);

    // 6. Test transaction simulation
    console.log("\n🧪 Testing transaction simulation...");
    try {
      const tx = {
        to: owner.address,
        value: ethers.parseEther
          ? ethers.parseEther("0")
          : ethers.utils.parseEther("0"),
        gasLimit: 21000,
      };

      const estimatedGas = await ethers.provider.estimateGas(tx);
      console.log("✅ Gas estimation works:", estimatedGas.toString());
    } catch (error) {
      console.error("❌ Gas estimation failed:", error.message);
    }

    // 7. Test muy simple deployment
    console.log("\n📦 Testing simple contract deployment...");
    try {
      // Crear un contrato muy simple para test
      const SimpleContract = await ethers.getContractFactory("DoomieNFT");

      // Solo estimamos el gas, no deployamos aún
      const deploymentData = SimpleContract.getDeployTransaction(owner.address);
      const estimatedGas = await ethers.provider.estimateGas({
        data: deploymentData.data,
      });
      console.log(
        "✅ Contract deployment gas estimation:",
        estimatedGas.toString()
      );
    } catch (error) {
      console.error("❌ Contract deployment estimation failed:", error.message);
      console.error("Full error:", error);
    }
  } catch (error) {
    console.error("\n❌ Debug failed:", error.message);
    console.error("Error code:", error.code);
    console.error("Error reason:", error.reason);

    // Suggestions based on error
    if (error.message.includes("could not detect network")) {
      console.log("\n💡 Suggestions:");
      console.log("- Check if RPC URL is correct and accessible");
      console.log("- Verify internet connection");
      console.log("- Try using a different RPC endpoint");
    } else if (error.message.includes("insufficient funds")) {
      console.log("\n💡 Suggestions:");
      console.log("- Get PAS tokens from Paseo faucet");
      console.log("- Verify account addresses are correct");
    } else if (error.message.includes("fields had validation errors")) {
      console.log("\n💡 Suggestions:");
      console.log("- Check chain ID configuration");
      console.log("- Verify private key format");
      console.log("- Check if network supports the transaction type");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
