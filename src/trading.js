import { connection, CONSTANTS } from './config.js';
import { sendPortalLocalTransactionBundle, confirmTransaction } from './transactions.js';
import { displayBalances, getWalletBalance } from './display.js';
import { getAllTokenBalances } from './tokenUtils.js';
import { keypair } from './config.js';
import { rateLimitRequest } from './utils.js';

let isProcessing = false;
let isShuttingDown = false;
let currentTokenMint = null;
let lastReceivedToken = null;
let currentTradeTimeout = null;
let profitCheckInterval = null;

async function ensureSOLBalance() {
    const tokenBalances = await rateLimitRequest(() => getAllTokenBalances(keypair.publicKey.toString()));
    
    for (const { mint, balance } of tokenBalances) {
        if (balance > 0) {
            console.log(`\nFound existing token ${mint}. Selling before new purchase...`);
            const txInfo = await sendPortalLocalTransactionBundle("sell", mint);
            if (txInfo) {
                await confirmTransaction(txInfo);
                console.log(`Successfully sold token ${mint}`);
            }
        }
    }
    
    await new Promise(resolve => setTimeout(resolve, CONSTANTS.REQUEST_RATE_LIMIT));
    return await rateLimitRequest(() => getWalletBalance());
}

export async function processToken(mint) {
    // Update last received token
    lastReceivedToken = mint;

    if (!mint || typeof mint !== 'string') {
        console.log("\nInvalid token mint address received. Skipping.");
        return;
    }

    if (isShuttingDown) {
        console.log("\nBot is shutting down. Skipping new token.");
        return;
    }

    // If already processing a token, skip new ones
    if (isProcessing) {
        console.log("\nCurrently processing another token. Skipping new token.");
        return;
    }

    try {
        isProcessing = true;
        currentTokenMint = mint;
        
        console.log("\nChecking balances before purchase...");
        const solBalance = await ensureSOLBalance();
        console.log(`Available SOL balance: ${solBalance.toFixed(4)} SOL`);

        if (solBalance < 0.01) {
            console.log("Insufficient SOL balance for trading. Minimum 0.01 SOL required.");
            cleanupCurrentTrade();
            return;
        }

        console.log(`\nPreparing to buy token: ${mint}`);
        const initialTokenBalance = solBalance;

        // Execute buy transaction
        const buyTxInfo = await sendPortalLocalTransactionBundle("buy", mint);
        if (!buyTxInfo) {
            console.log("Failed to create buy transaction.");
            cleanupCurrentTrade();
            return;
        }

        // Wait for transaction confirmation
        const confirmed = await confirmTransaction(buyTxInfo);
        if (!confirmed) {
            console.log("Buy transaction failed to confirm.");
            cleanupCurrentTrade();
            return;
        }

        console.log("Buy transaction confirmed. Token purchased successfully.");
        
        // Start monitoring the trade
        setupProfitMonitoring(initialTokenBalance);

    } catch (error) {
        console.error("Error processing token:", error);
        cleanupCurrentTrade();
    }
}

function cleanupCurrentTrade() {
    isProcessing = false;
    currentTokenMint = null;
    if (currentTradeTimeout) {
        clearTimeout(currentTradeTimeout);
        currentTradeTimeout = null;
    }
    if (profitCheckInterval) {
        clearInterval(profitCheckInterval);
        profitCheckInterval = null;
    }
}

function setupProfitMonitoring(initialTokenBalance) {
    if (currentTradeTimeout) clearTimeout(currentTradeTimeout);
    if (profitCheckInterval) clearInterval(profitCheckInterval);

    // Set timeout for max holding time
    currentTradeTimeout = setTimeout(() => {
        if (!isShuttingDown) {
            console.log("\nMax holding time reached. Initiating sale...");
            sellCurrentToken(initialTokenBalance);
        }
    }, CONSTANTS.MAX_HOLDING_TIME);

    // Start profit monitoring
    profitCheckInterval = setInterval(async () => {
        if (isShuttingDown) {
            cleanupCurrentTrade();
            return;
        }

        const currentBalance = await rateLimitRequest(() => getWalletBalance());
        const profit = currentBalance - initialTokenBalance;
        const profitPercentage = ((profit / initialTokenBalance) * 100).toFixed(2);

        console.log(`Current profit: ${profit.toFixed(4)} SOL (${profitPercentage}%)`);

        if (profit >= CONSTANTS.MINIMAL_PROFIT_THRESHOLD) {
            console.log(`\nProfit threshold met. Selling token: ${currentTokenMint} for a profit of ${profit.toFixed(4)} SOL`);
            cleanupCurrentTrade();
            await sellCurrentToken(initialTokenBalance);
        }
    }, CONSTANTS.PROFIT_CHECK_INTERVAL);
}

export async function sellCurrentToken(initialTokenBalance) {
    if (!currentTokenMint) {
        console.log("\nNo token to sell.");
        return;
    }

    const tokenToSell = currentTokenMint;
    console.log(`\nInitiating sale of token: ${tokenToSell}`);
    
    const sellTxInfo = await sendPortalLocalTransactionBundle("sell", tokenToSell);
    if (!sellTxInfo) {
        console.log("Failed to create sell transaction.");
        return;
    }

    const confirmed = await confirmTransaction(sellTxInfo);
    if (!confirmed) {
        console.log("Sell transaction failed to confirm.");
        return;
    }

    console.log(`Token ${tokenToSell} sold successfully.`);
    
    const finalBalance = await rateLimitRequest(() => getWalletBalance());
    const profit = finalBalance - initialTokenBalance;
    console.log(`\n=== Trade Summary ===`);
    console.log(`Profit from this trade: ${profit.toFixed(4)} SOL`);

    cleanupCurrentTrade();
    await displayBalances();
}

export async function cleanupAndExit() {
    isShuttingDown = true;
    console.log('\nInitiating cleanup process...');
    
    while (isProcessing) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const tokenBalances = await rateLimitRequest(() => getAllTokenBalances(keypair.publicKey.toString()));
    if (tokenBalances.length > 0) {
        console.log('\nSelling all remaining tokens...');
        for (const { mint, balance } of tokenBalances) {
            if (balance > 0) {
                console.log(`Selling token ${mint}...`);
                const sellTxInfo = await sendPortalLocalTransactionBundle("sell", mint);
                if (sellTxInfo) {
                    await confirmTransaction(sellTxInfo);
                    console.log(`Successfully sold token ${mint}`);
                }
            }
        }
    }
    
    console.log('\nFinal wallet status:');
    await displayBalances();
    console.log('\nCleanup complete. Exiting...');
}

export { isProcessing, currentTokenMint };