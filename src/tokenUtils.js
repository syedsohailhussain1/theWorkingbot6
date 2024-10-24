import { PublicKey } from '@solana/web3.js';
import { connection } from './config.js';
import { rateLimitRequest } from './utils.js';

export async function getTokenBalance(walletAddress, mintAddress) {
    return rateLimitRequest(async () => {
        try {
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                new PublicKey(walletAddress),
                { mint: new PublicKey(mintAddress) }
            );

            if (tokenAccounts.value.length > 0) {
                const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount;
                return parseFloat(balance.uiAmount);
            }
            return 0;
        } catch (error) {
            console.error("Error fetching token balance:", error);
            return 0;
        }
    });
}

export async function getAllTokenBalances(walletAddress) {
    return rateLimitRequest(async () => {
        try {
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                new PublicKey(walletAddress),
                { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
            );

            return tokenAccounts.value
                .filter(account => {
                    const balance = account.account.data.parsed.info.tokenAmount;
                    return parseFloat(balance.uiAmount) > 0;
                })
                .map(account => ({
                    mint: account.account.data.parsed.info.mint,
                    balance: parseFloat(account.account.data.parsed.info.tokenAmount.uiAmount)
                }));
        } catch (error) {
            console.error("Error fetching all token balances:", error);
            return [];
        }
    });
}