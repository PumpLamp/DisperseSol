import figlet from "figlet";
import chalk from "chalk";
import Table from "cli-table";
import { Command } from "program-commander";
import { number } from "@inquirer/prompts";
import { keypairs } from "./src/create_keypairs.js";
import * as utils from "./src/utils.js";
import fs from "node:fs";
import { checkBalance, collectSol, driftDisperse } from "./src/drift.js";

const settings = JSON.parse(fs.readFileSync(".env", "utf8"));
const program = new Command();

console.log(chalk.cyanBright.bold("Stealth Sol Disperser - A tool to disperse SOL to multiple wallets using Drift Protocol"));
console.log(chalk.yellowBright.bold("Version: 1.0.0"));


export async function main() {
    program
        .addHelpText("before", figlet.textSync("Stealth Sol Disperser"))
        .helpOption("-h, --help", "display help for command")
        .description("This script is a bot for transfer SOL to multiple wallets without being detected by Bubblemaps.io.")
        .option("--create-wallets", "Create Wallets")
        .option("--disperse", "Disperse SOL to wallets")
        .option("--collect-all-sol", "Collect all SOL from wallets to main wallet")
        .option("--check", "Check Balance from wallets")
        .action(async (options) => {
            if (Object.keys(options).length == 0) {
                console.log("Please see command help with `node app.js --help`")
            }
            if (options.createWallets) {
                keypairs();
            }
            if (options.disperse) {
                driftDisperse();
            }
            if (options.collectAllSol) {
                collectSol();
            }
            if (options.check) {
                checkBalance();
            }

            home();
        });

    program.parse(process.argv).opts();

}

export async function home() {
    if (!checkSettings()) return;
    const fig_text = figlet.textSync("Stealth Sol Disperser", {
        font: "ANSI Shadow",
        horizontalLayout: "default",
        verticalLayout: "default",
        width: 150,
        whitespaceBreak: true,
    });
    console.log(chalk.cyanBright.bold(fig_text));
    var table = new Table({
        head: ["Command", "Label", "Description"],
    });

    table.push(
        [
            "1",
            chalk.greenBright.bold("Create Wallets"),
            "Generate wallets used for disperse SOL.\nYou can skip if you already have wallets in wallets.txt.\nFORMAT => publicKey:secretKey",
        ],
        [
            "2",
            chalk.yellowBright.bold("Disperse SOL"),
            "Disperse SOL to multiple wallets",
        ],
        [
            "3",
            chalk.cyanBright.bold("Collect All SOL"),
            "Collect SOL to account wallet from multiple wallets",
        ],
        [
            "4",
            chalk.green.bold("Balance Check"),
            "Balance check from wallets",
        ],
        ["5", chalk.redBright.bold("Quit"), "Quit the bot interface"]
    );

    console.log(table.toString());

    const option = await number({
        message: "reply with command number:",
        validate: (data) => {
            if (data < 1 || data > 6) {
                return "Provided option invalid, choose from the menu number available";
            }

            if (data == undefined) {
                return "Input cannot be empty";
            }

            return true;
        },
    });

    switch (option) {
        case 1:
            keypairs();
            break;
        case 2:
            driftDisperse();
            break;
        case 3:
            collectSol();
            break;
        case 4:
            checkBalance();
            break;
        case 5:
            process.exit(0);
        default:
            break;
    }

}

function checkSettings() {
    if (!settings?.rpc || !utils.isUrlValid(settings.rpc)) {
        console.log(chalk.redBright.bold("SETTINGS ERROR: ") + "Invalid 'rpc' in " + chalk.yellow.bold(".env"));
        return false;
    }
    if (!settings?.main_wallet_pk || !utils.isValidPrivateKey(settings.main_wallet_pk)) {
        console.log(chalk.redBright.bold("SETTINGS ERROR: ") + "Invalid 'main_wallet_pk' in " + chalk.yellow.bold(".env"));
        console.log("Please input private key of the main wallet in .env file");
        return false;
    }
    return true;
}

main();