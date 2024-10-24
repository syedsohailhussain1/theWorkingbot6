import { CONSTANTS } from './config.js';

export function formatBalance(balance) {
    if (balance === 0) return '0.0000';
    if (balance < 0.0001) return '<0.0001';
    return balance.toFixed(4);
}

// Rate limiter implementation
let lastRequestTime = 0;

export async function rateLimitRequest(callback) {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < CONSTANTS.REQUEST_RATE_LIMIT) {
        await new Promise(resolve => 
            setTimeout(resolve, CONSTANTS.REQUEST_RATE_LIMIT - timeSinceLastRequest)
        );
    }
    
    lastRequestTime = Date.now();
    return callback();
}