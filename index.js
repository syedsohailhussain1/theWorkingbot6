import WebSocket from 'ws';
import { displayBalances } from './src/display.js';
import { processToken, cleanupAndExit } from './src/trading.js';
import { CONSTANTS } from './src/config.js';

console.log("=== PumpPortal Trading Bot ===");

let ws = new WebSocket('wss://pumpportal.fun/api/data');

// Start the balance update interval
displayBalances();
const balanceInterval = setInterval(displayBalances, CONSTANTS.BALANCE_UPDATE_INTERVAL);

// Graceful shutdown handler
async function handleShutdown() {
    console.log('\nShutting down gracefully...');
    clearInterval(balanceInterval);
    ws.close();
    
    await cleanupAndExit();
    process.exit(0);
}

// Register shutdown handlers
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

// WebSocket event handlers
ws.on('open', function open() {
    console.log('Connected to PumpPortal WebSocket');
    ws.send(JSON.stringify({ method: "subscribeNewToken" }));
    console.log('Subscribed to new token events');
});

ws.on('message', async function message(data) {
    try {
        const parsedData = JSON.parse(data);
        if (parsedData.mint) {
            console.log('\n=== New Token Detected ===');
            console.log(`Mint: ${parsedData.mint}`);
            console.log(`Name: ${parsedData.name || 'Unknown'}`);
            console.log(`Symbol: ${parsedData.symbol || 'Unknown'}`);
            await processToken(parsedData.mint);
        }
    } catch (error) {
        console.error("Error processing message:", error);
    }
});

ws.on('close', function close() {
    console.log('WebSocket connection closed. Attempting to reconnect...');
    setTimeout(() => {
        ws = new WebSocket('wss://pumpportal.fun/api/data');
    }, 3000);
});

ws.on('error', function error(err) {
    console.error('WebSocket error:', err);
});