import { DriftClient, Wallet } from "@drift-labs/sdk";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, VersionedTransaction, TransactionMessage, SystemProgram, sendAndConfirmTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import * as utils from "./utils.js";
import { input } from "@inquirer/prompts";
import * as logger from "./logger.js";
import { goHome } from "./common.js";
import { number } from "@inquirer/prompts";
import {
    createAssociatedTokenAccountIdempotentInstruction,
    getAssociatedTokenAddressSync,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    createCloseAccountInstruction,
} from '@solana/spl-token';
import fs from "node:fs";
import { Transaction } from "@solana/web3.js";
import Table from "cli-table";
import chalk from "chalk";

const settings = JSON.parse(fs.readFileSync(".env", "utf8"));
const connection = new Connection(settings.rpc);
let accountKeyPair = null;
let accountWallet = null;
try {
    accountKeyPair = Keypair.fromSecretKey(bs58.decode(settings.main_wallet_pk));
    accountWallet = new Wallet(accountKeyPair);
} catch (e) {
    logger.error("Invalid main_wallet_pk in .env file. Please check again.\n\n");
    process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

const marketIndex = 1;
const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const MIN_TRANSFER_SOL = 0.002;
const amountFilePath = "withdraw.json";

export const driftDisperse = async () => {
    const wallets = utils.parseKeys("wallets.txt");

    const table = new Table({
        head: ["Command", "Label", "Description"],
    });

    table.push(
        [
            "1",
            chalk.greenBright.bold("Amounts from file"),
            "Read withdraw amount info from withdraw.json file",
        ],
        [
            "2",
            chalk.blue.bold("Unique amounts for each wallet"),
            "Withdraw the same amount to each wallets",
        ],
        [
            "3",
            chalk.yellowBright.bold("Random amount"),
            "Withdraw the random amount between min and max value",
        ],
        ["4", chalk.redBright.bold("Back"), "Back to main menu"]
    );

    console.log(table.toString());

    const option = await number({
        message: "reply with command number:",
        validate: (data) => {
            if (data < 1 || data > 4) {
                return "Provided option invalid, choose from the menu number available";
            }

            if (data == undefined) {
                return "Input cannot be empty";
            }
            return true;
        },
    });

    let amounts = [];
    let amount;
    let min, max;

    switch (option) {
        case 1:
            amounts = getAmountsFromFile();
            if (!amounts)
                goHome(3000);
            console.log(amounts);
            break;
        case 2:
            amount = await getUniqueAmount();
            break;
        case 3:
            [min, max] = await getMinMaxAmount();
            break;
        case 4:
            goHome();
            return;
        default:
            goHome();
            return;
    }

    logger.info(`🕐 Dispersing start...`);

    const promises = [];

    for (let i = 0; i < wallets.length; i++) {
        let withdrawAmount;
        switch (option) {
            case 1:
                withdrawAmount = amounts[i];
                break;
            case 2:
                withdrawAmount = amount;
                break;
            case 3:
                withdrawAmount = Math.random() * (max - min) + min;
                break;
        }
        promises.push(withdrawOneWallet(wallets[i], withdrawAmount));
    }

    await Promise.all(promises);
    logger.info(`🎈 Disperse finished...`);
    goHome(5000);
}

const getAmountsFromFile = () => {
    if (!fs.existsSync(amountFilePath)) {
        logger.error("withdraw.json file is not exist");
        return null;
    }

    const data = fs.readFileSync("withdraw.json", "utf8");
    const amounts = JSON.parse(data);
    const values = amounts.map(v => parseFloat(v) > MIN_TRANSFER_SOL ? parseFloat(v) : MIN_TRANSFER_SOL);
    return values;
}

const getUniqueAmount = async () => {
    const amount = await input({
        message: "Input unique amounts for each wallet: ",
        validate: (data) => {
            const value = parseFloat(data);
            if (isNaN(value)) {
                return "Please enter a valid number.";
            }
            if (value < MIN_TRANSFER_SOL) {
                return "Minimum value is 0.01 SOL";
            }

            return true;
        },
    })
    return parseFloat(amount);
}

const getMinMaxAmount = async () => {
    const minStr = await input({
        message: "Min SOL amount to withdraw to each wallet: ",
        validate: (data) => {
            const value = parseFloat(data);
            if (isNaN(value)) {
                return "Please enter a valid number.";
            }
            if (value < MIN_TRANSFER_SOL) {
                return "Min value is 0.01 SOL";
            }

            return true;
        },
    })

    const min = parseFloat(minStr);

    const maxStr = await input({
        message: "Max SOL amount to withdraw to each wallet: ",
        validate: (data) => {
            const value = parseFloat(data);
            if (isNaN(value)) {
                return "Please enter a valid number.";
            }

            if (value < min) {
                return "Please enter bigger than Min amount.";
            }

            if (value < 0.01) {
                return "Min value is 0.01 SOL";
            }

            return true;
        },
    })

    const max = parseFloat(maxStr);
    return [min, max];
}

const withdrawOneWallet = async (wallet, amount) => {
    const driftClient = new DriftClient({
        connection,
        wallet: accountWallet,
        env: 'mainnet-beta',
    })
    await driftClient.subscribe();

    const mainWalletBalance = await utils.getSolBalance(accountKeyPair.publicKey, connection);
    if (mainWalletBalance < amount + 0.01) {
        logger.info(`Main wallet balance: ${mainWalletBalance}`);
        logger.error(`Not enough SOL in main wallet to withdraw ${amount} SOL to ${wallet.publicKey.toBase58()}`);
        return;
    }

    const driftAmount = driftClient.convertToSpotPrecision(marketIndex, amount - MIN_TRANSFER_SOL);
    const instructions = [];
    const ata = getAssociatedTokenAddressSync(WSOL_MINT, wallet.publicKey);
    const instruction = createAssociatedTokenAccountIdempotentInstruction(
        accountKeyPair.publicKey,
        ata,
        wallet.publicKey,
        WSOL_MINT
    );
    instructions.push(instruction);

    if (amount > 0) {
        instructions.push(
            SystemProgram.transfer({
                fromPubkey: accountKeyPair.publicKey,
                toPubkey: ata,
                lamports: driftAmount,
            })
        );
    }

    instructions.push(createCloseAccountInstruction(ata, wallet.publicKey, wallet.publicKey, []));

    const tx = await driftClient.buildTransaction(instructions);

    logger.info(`🕐 Withdraw Trx size: ${tx.serialize().length}`);
    await driftClient.sendTransaction(tx, [accountKeyPair, wallet]);

    logger.info(`✅ Successfully dispersed ${amount} SOL to ${wallet.publicKey.toBase58()}.`);
}

export const collectSol = async () => {
    const wallets = utils.parseKeys("wallets.txt");
    await withdrawSolFromWallets(accountKeyPair, wallets);
    logger.info(`💰 Collect SOL finished`);
    goHome(3000);
}

const withdrawSolFromWallets = async (
    depositWallet,
    wallets, // [keyPair]
) => {
    try {
        let transaction = new Transaction();
        let signers = [];
        for (let i = 0; i < wallets.length; i++) {
            const wallet = wallets[i];
            const solBalance = await connection.getBalance(wallet.publicKey);
            let lamports = solBalance;

            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: wallet.publicKey,
                    toPubkey: depositWallet.publicKey,
                    lamports
                }));
            transaction.feePayer = depositWallet.publicKey;
            signers.push(wallet);
            if ((i + 1) % 8 == 0 || i == wallets.length - 1) {
                signers.push(depositWallet);

                let signature = await sendAndConfirmTransaction(connection, transaction, signers);
                if (!signature) logger.error(`Failed to collect SOL from ${wallet.publicKey.toBase58()}`)
                else logger.info(`✅ Success to collect SOL from ${wallet.publicKey.toBase58()}`)
                signers.length = 0;
                transaction = new Transaction();
            }
        }
        return true;
    } catch (error) {
        logger.error("solana->withdrawSolFromWallets:", error);
        return false;
    }
}

export const checkBalance = async () => {
    console.log("⏳ Please wait...");
    const wallets = utils.parseKeys("wallets.txt");

    const table = new Table({
        head: ["Wallet Name", "Address", "SOL Balance"],
    });

    table.push(
        ["Deposit Wallet",
            accountKeyPair.publicKey.toBase58(),
            await utils.getSolBalance(accountKeyPair.publicKey, connection)]
    )

    for (let i = 0; i < wallets.length; i++) {
        table.push(
            [
                `Wallet${i + 1}`,
                wallets[i].publicKey.toBase58(),
                await utils.getSolBalance(wallets[i].publicKey, connection)
            ]
        )
    }

    console.log(table.toString());

    await input({
        message: "Input 1 to return to main menu: ",
        validate: (data) => {
            const value = parseFloat(data);
            if (isNaN(value)) {
                return "Please enter a valid number.";
            }

            if (value != 1) {
                return "Invaid Value";
            }
            return true;
        },
    })
    goHome(1000);
}