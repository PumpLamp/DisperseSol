import {
    Keypair,
    PublicKey,
    VersionedTransaction,
    TransactionMessage,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import fs from "node:fs";
import bs58 from 'bs58';

export const getRandomNumber = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const sleep = ms => new Promise(r => setTimeout(r, ms))

export const checkTokenAccountExists = async (conn, tokenAccountAddress) => {
    try {
        const accountInfo = await conn.getAccountInfo(new PublicKey(tokenAccountAddress));
        // console.log("account info:", accountInfo)
        return accountInfo !== null;
    } catch (e) {
        console.log("Error checking token account existence: ", e);
        return false;
    }
}
export const isEmpty = value => {
    if (value == undefined || value == "" || !value) return true;
    return false;
}

export async function getSolBalance(walletAddress, connection) {

    // Fetch the balance (returns balance in lamports, 1 SOL = 10^9 lamports)
    const balance = await connection.getBalance(walletAddress);

    // Convert lamports to SOL
    const solBalance = Number(balance.toFixed(0)) / LAMPORTS_PER_SOL;
    return solBalance;
}

export async function sendSuccessfulTransaction(
    connection,
    transaction,
    signer,
    attempt = 0,
    maxRetry = 3
) {
    while (1) {
        try {
            const signature = await connection.sendTransaction(transaction, [signer]);
            let rlt = await connection.confirmTransaction(signature, "confirmed");
            return signature;
        } catch (error) {
            if (attempt < maxRetry) {
                logger.error(`Error sending transaction for wallet, attempt ${attempt + 1}:` + error)
                await sleep((attempt + 1) * 1000);
                return sendSuccessfulTransaction(transaction, signer, attempt + 1);
            } else {
                console.error(`Transaction send failed after ${maxRetry} attempts:` + error);
                return false;
            }
        }
    }
}

export async function getTokenAccountBalance(
    conn,
    walletAddress,
    mintAddress) {
    try {
        const tokenAccounts = await conn.getParsedTokenAccountsByOwner(
            walletAddress,
            { mint: mintAddress }
        );

        if (!tokenAccounts)
            return 0;

        // Extract the token amount from the first account (if multiple accounts exist)
        const balance =
            tokenAccounts.value[0]?.account.data.parsed.info.tokenAmount.uiAmount;
        return balance || 0;
    } catch (e) {
        console.log("get token balance error: ", e);
        return -1;
    }
}

export const getSafeTokenBalance = async (
    conn,
    walletAddr,
    tokenMintAddr
) => {
    let tokenBalance = -1;

    while (1) {
        let checkExsit = await checkTokenAccountExists(conn, tokenMintAddr);
        if (!checkExsit)
            return 0;
        tokenBalance = await getTokenAccountBalance(
            conn,
            new PublicKey(walletAddr),
            new PublicKey(tokenMintAddr)
        );
        if (tokenBalance !== -1) break;
        await sleep(50);
    }
    return tokenBalance;
}

export const getKeypairFromBase58 = (pk) => {
    return Keypair.fromSecretKey(bs58.decode(pk));
}

export const isValidPublicKey = (pubkey) => {
    try {
        const publicKey = new PublicKey(pubkey);
        return true;
    } catch (error) {
        console.log("Invalid Key format!", error)
        return false;
    }
}

export const isValidPrivateKey = (privKey) => {
    try {
        Keypair.fromSecretKey(bs58.decode(privKey));
        return true
    } catch (error) {
        // console.log("Invalid Key format!", error)
        return false
    }
}

export const isUrlValid = string => {
    var res = string.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g);
    if (res == null)
        return false;
    else
        return true;
}

export const getPrivateKeyFromKeyPair = (keyPair) => {
    if (!keyPair || !isValidPrivateKey(keyPair.secretKey)) {
        console.log("Invalid keypair format!")
        return
    }
    return bs58.encode(keyPair.secretKey)
}

export const getPublicKeyFromKeyPair = (keyPair) => {
    if (!keyPair || !isValidPublicKey(keyPair.publicKey.toString())) {
        console.log("Invalid keypair format!")
        return
    }
    return keyPair?.publicKey.toString();
}


export async function getVersionedTransaction(
    connection,
    ownerPubkey,
    instructionArray,
    lookupTableAccount = undefined,
) {
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const messageV0 = new TransactionMessage({
        payerKey: ownerPubkey,
        instructions: instructionArray,
        recentBlockhash: recentBlockhash,
    }).compileToV0Message(lookupTableAccount ? [lookupTableAccount] : undefined);

    return new VersionedTransaction(messageV0);
}

export const parseKeys = (fileName) => {
    try {
        const data = fs.readFileSync(fileName, 'utf8');

        // Split the file content into lines (assuming each line contains a public:private key pair)
        const keyLines = data.split('\n');
        const PKLines = [];

        // Loop through each line
        keyLines.forEach(line => {
            if (line.trim() === '') return; // Skip empty lines

            // Split the line into public and private keys (split by colon)
            const [publicKeyString, privateKeyString] = line.split(':');
            if (!publicKeyString || !privateKeyString) {
                console.error('Invalid line format:', line);
                return;
            }

            // Remove any carriage return or extra whitespace characters
            const cleanPrivateKey = privateKeyString.replace(/[\r\n]+/g, '').trim();
            PKLines.push(getKeypairFromBase58(cleanPrivateKey));
        });
        return PKLines;
    } catch (error) {
        console.error('Error reading file:', error);
    }
}