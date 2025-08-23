import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import chalk from "chalk";
import { number } from "@inquirer/prompts";
import fs from "node:fs";

// MAIN MENU
import * as logger from "./logger.js";
import { goHome } from "./common.js";

export async function keypairs() {
  const filePath = "wallets.txt";
  const amountFilePath = "withdraw.json"

  console.log(chalk.cyanBright.bold("\nCreate Wallets\n"));
  console.log("You can skip this step if you already have wallets.\nEnsure you have wallets in wallets.txt file in format publicKey:secretKey\n");

  const answer = await number({
    message: "how many wallets are you going to create? Input 0 to return to main menu.",
    default: 15,
    validate: (data) => {
      if (data == 0) {
        return true;
      }
      if (data < 2) {
        return "Minimum wallets count is 2";
      }
      return true;
    },
  });

  if (answer == 0) {
    goHome(1000);
    return;
  }

  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    if (stats.size > 0) {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, "0");
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const hour = String(now.getHours()).padStart(2, "0");
      const min = String(now.getMinutes()).padStart(2, "0");

      const backupName = `walletBackup/wallets-${day}-${month}-${hour}-${min}.txt`;

      fs.copyFileSync(filePath, backupName);
      logger.info(`📁 Existing wallets.txt backed up as ${backupName}`);
    }
  }

  // GENERATE KEYPAIRs ACCORDING TO ANSWER
  const keypairs = [];
  const amounts = {};

  logger.info(`🕐 Generating ${answer} keypairs...`);
  for (let i = 0; i < answer; i++) {
    const keypair = Keypair.generate();

    keypairs.push({
      publicKey: keypair.publicKey.toBase58(),
      secretKey: bs58.encode(keypair.secretKey),
    });

    amounts[`wallet${i + 1}`] = 0;
  }

  // WRITE TO JSON FILE (wait for a second)
  setTimeout(() => {
    const keypairLines = keypairs
      .map(({ publicKey, secretKey }) => `${publicKey}:${secretKey}`)
      .join('\n');

    fs.writeFile(filePath, keypairLines, "utf8", (err) => {
      if (err) {
        logger.error("An error occurred while writing the file:", err);
      } else {
        logger.info(
          "✅ Wallet addresses have been written to wallets.txt."
        );
      }
    });
    fs.writeFile(amountFilePath, JSON.stringify(amounts, null, 2), "utf-8", (err) => {
      if (err) {
        logger.error("An error occurred while writing the file:", err);
      } else {
        logger.info(
          "✅ Withdraw amounts file generated as withdraw.json."
        );
      }
    })
  }, 1000);

  // RETURN TO MAIN MENU (HOME) (wait for 5 seconds)
  goHome(3000)
}
