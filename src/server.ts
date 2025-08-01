import express, { Request, Response } from 'express';
import cron from 'node-cron';
import { initializeLit } from './lit/functions.js';

import dotenv from 'dotenv';
import { UserRepository } from './db.js';
import { TradeParams, Trader } from './trade.js';
import { LitNodeClient } from '@lit-protocol/lit-node-client';
dotenv.config();

const app = express();
const PORT = 4002;

app.use(express.json());

let litNodeClient: LitNodeClient
const userRepository = new UserRepository()
const trader = new Trader(litNodeClient)

interface SignupRequestBody {
    address: string;
    lit_id: string;
    pkpSessionSigs: string; // Should be a stringified JSON
}

interface TestTradeRequestBody extends TradeParams {
    address: string;
}

app.post('/signup', async (req: Request<{}, {}, SignupRequestBody>, res: Response) => {
    const { address, lit_id, pkpSessionSigs } = req.body;

    if (!address || !lit_id || !pkpSessionSigs) {
        return res.status(400).json({ error: 'Missing id or pkpSessionSigs' });
    }

    try {
        await userRepository.upsertUser({
            address: address,
            lit_id: lit_id,
            session_sigs: pkpSessionSigs,
        })
        res.status(200).json({ success: true, message: `Successful signup: ${address}` });
    } catch (err) {
        console.error('Error writing file:', err);
        res.status(500).json({ error: `Failed to signup: ${address}` });
    }
});

app.get('/test_trade', async (req: Request<{}, {}, TestTradeRequestBody>, res: Response) => {

    await userRepository.connect();
    const { address, symbol, side, amount } = req.body;
    const user = await userRepository.getUser(address);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    if (!symbol || !side || !amount) {
        return res.status(400).json({ error: 'Missing trade parameters' });
    }

    try {
        const tradeParams: TradeParams = {
            symbol: symbol,
            side: side,
            amount: amount
        };
        await trader.tradeForUsers([user], tradeParams);
        res.status(200).json({ success: true, message: `Trade executed for user ${address}` });
    } catch (err) {
        console.error('Error executing trade:', err);
        res.status(500).json({ error: `Failed to execute trade for user ${address}` });
    }
})

async function startScheduler() {
    const tradeSymbols = process.env.TRADE_SYMBOLS?.split(',') || ['ETH']
    const cronString = process.env.CRON_STRING || '* * * * *'; // Default to every minute if not set
    console.log("Trade symbols:", tradeSymbols);
    cron.schedule(cronString, async () => {
        console.log(`Running scheduled API call at ${new Date().toISOString()}`);
        try {
            for (let symbol of tradeSymbols) {
                console.log(`Checking trades for symbol: ${symbol}`);
                let tradeParams = await trader.shouldTrade(symbol);
                if (tradeParams) {
                    const users = await userRepository.getAllUsers();
                    await trader.tradeForUsers(users, tradeParams);
                }
            }
        } catch (err) {
            console.error('Error during scheduled task:', err);
        }
    });
    console.log('Scheduler started: Every minute');
}


app.listen(PORT, async () => {
    const res = await initializeLit()
    litNodeClient = res.litNodeClient;
    await startScheduler()
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});



