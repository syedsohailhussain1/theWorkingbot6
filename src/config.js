import dotenv from 'dotenv';
import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

dotenv.config();

if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY environment variable is required');
}

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_ENDPOINT = 'https://floral-spring-water.solana-mainnet.quiknode.pro/4baf34163bbb4ccf1d273dfd290c9203d56a7298';

const CONSTANTS = {
    MINIMAL_PROFIT_THRESHOLD: 0.005,
    MAX_HOLDING_TIME: 10 * 1000,
    PROFIT_CHECK_INTERVAL: 300,
    BALANCE_UPDATE_INTERVAL: 300,
    REQUEST_RATE_LIMIT: 500,
    MAX_RETRIES: 3,
    RETRY_DELAY: 500,
    
    // Trading parameters
    BUY_AMOUNT: 1000000,
    SLIPPAGE: 15,
    PRIORITY_FEE: 0.0001,
    POOL: "pump"
};

let keypair;
try {
    keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
} catch (error) {
    throw new Error('Invalid private key format: ' + error.message);
}

const connection = new Connection(RPC_ENDPOINT, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 30000,
    wsEndpoint: RPC_ENDPOINT.replace('https', 'wss')
});

export { PRIVATE_KEY, RPC_ENDPOINT, CONSTANTS, keypair, connection };