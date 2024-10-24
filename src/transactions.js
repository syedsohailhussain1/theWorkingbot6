import fetch from 'node-fetch';
import { VersionedTransaction } from '@solana/web3.js';
import bs58 from "bs58";
import { keypair, connection, CONSTANTS } from './config.js';

export async function sendPortalLocalTransactionBundle(action, mint) {
    console.log(`\nAttempting to ${action} token: ${mint}`);
    const bundledTxArgs = [{
        publicKey: keypair.publicKey.toBase58(),
        action: action,
        mint: mint,
        denominatedInSol: "false",
        amount: CONSTANTS.BUY_AMOUNT,
        slippage: CONSTANTS.SLIPPAGE,
        priorityFee: CONSTANTS.PRIORITY_FEE,
        pool: CONSTANTS.POOL
    }];

    try {
        const latestBlockhash = await connection.getLatestBlockhash('finalized');
        
        const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bundledTxArgs)
        });

        if (!response.ok) {
            console.log("Error response:", await response.text());
            return null;
        }

        const transactions = await response.json();
        const encodedSignedTransactions = [];
        const signatures = [];

        for (const txEncoded of transactions) {
            const tx = VersionedTransaction.deserialize(new Uint8Array(bs58.decode(txEncoded)));
            tx.sign([keypair]);
            const serialized = tx.serialize();
            encodedSignedTransactions.push(bs58.encode(serialized));
            signatures.push(bs58.encode(tx.signatures[0]));
        }

        // Send to Jito and RPC simultaneously for better confirmation chances
        await Promise.all([
            sendToJito(encodedSignedTransactions),
            sendToRPC(encodedSignedTransactions)
        ]);

        logTransactions(signatures);

        return {
            signature: signatures[0],
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
        };
    } catch (error) {
        console.error("Error in sendPortalLocalTransactionBundle:", error);
        return null;
    }
}

async function sendToJito(encodedSignedTransactions) {
    try {
        const jitoResponse = await fetch(`https://mainnet.block-engine.jito.wtf/api/v1/bundles`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "sendBundle",
                "params": [encodedSignedTransactions]
            })
        });
        
        const jitoResult = await jitoResponse.json();
        console.log("Jito Response:", jitoResult);
        return jitoResult;
    } catch (error) {
        console.error("Error sending to Jito:", error.message);
    }
}

async function sendToRPC(encodedSignedTransactions) {
    try {
        for (const tx of encodedSignedTransactions) {
            await connection.sendRawTransaction(bs58.decode(tx), {
                skipPreflight: true,
                maxRetries: 3
            });
        }
    } catch (error) {
        console.error("Error sending to RPC:", error.message);
    }
}

function logTransactions(signatures) {
    signatures.forEach((signature, index) => {
        console.log(`Transaction ${index}: https://solscan.io/tx/${signature}`);
    });
}

export async function confirmTransaction(txInfo) {
    if (!txInfo?.signature) return false;

    try {
        const result = await connection.confirmTransaction({
            signature: txInfo.signature,
            blockhash: txInfo.blockhash,
            lastValidBlockHeight: txInfo.lastValidBlockHeight
        }, 'confirmed');

        return !result.value.err;
    } catch (error) {
        console.error("Error confirming transaction:", error);
        return false;
    }
}