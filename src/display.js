import { connection, keypair, CONSTANTS } from './config.js';
import { getAllTokenBalances } from './tokenUtils.js';
import { formatBalance, rateLimitRequest } from './utils.js';

export async function displayBalances() {
    try {
        const [solBalance, tokenBalances] = await Promise.all([
            rateLimitRequest(() => getWalletBalance()),
            rateLimitRequest(() => getAllTokenBalances(keypair.publicKey.toString()))
        ]);
        
        // Clear previous line without clearing entire console
        process.stdout.write('\x1b[1A\x1b[2K');
        
        console.log(`\n[${new Date().toLocaleTimeString()}] Wallet Status:`);
        console.log(`SOL: ${formatBalance(solBalance)} SOL`);
        
        if (tokenBalances.length > 0) {
            tokenBalances.forEach(({ mint, balance }) => {
                console.log(`${mint.slice(0, 8)}...${mint.slice(-8)}: ${formatBalance(balance)}`);
            });
        }
        console.log('─'.repeat(50));
    } catch (error) {
        console.error("Error displaying balances:", error);
    }
}

export async function getWalletBalance() {
    try {
        const balance = await connection.getBalance(keypair.publicKey);
        return balance / 1e9;
    } catch (error) {
        console.error("Error fetching wallet balance:", error);
        return 0;
    }
}