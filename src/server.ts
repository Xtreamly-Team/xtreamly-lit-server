import express, { Request, Response } from 'express';
import { writeFile, readdir } from 'fs/promises';
import cron from 'node-cron';
import { initializeLit, readPkpSessionSigsFromFile, writePkpSessionSigsToFile } from './lit/functions.js';

import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = 4002;

app.use(express.json());

// Define the expected shape of the request body
interface SignupRequestBody {
    id: string;
    pkpSessionSigs: string; // Should be a stringified JSON
}


let litNodeClient
let pkpPublicKey
let ethersSigner

async function initialize() {
    const res = await initializeLit()
    litNodeClient = res.litNodeClient;
    pkpPublicKey = res.pkpPublicKey;
    ethersSigner = res.ethersSigner;
}

async function getUserFiles() {
    const files = await readdir('./users', { withFileTypes: true });
    return files.map(file => file.isFile() ? file.name : null).filter(Boolean);
}

async function executeTradeForUsers() {
    console.log("Checking volatility...");
    const volatilityPrediction = await fetch(`https://api.xtreamly.io/volatility_prediction_pos?symbol=ETH&horizon=60`, {
        method: 'GET',
        headers: {
            'x-api-key': process.env.XTREAMLY_API_KEY,
        },
    })
    const volatility = (await volatilityPrediction.json())['volatility'];
    console.log("Volatility prediction:", volatility);
    if (volatility > 0.008260869599999996) {
        console.log(`Volatility is high: ${volatility}. Executing trades for users...`);
        for (const file of await getUserFiles()) {
            try {
                const userData = await readPkpSessionSigsFromFile(file);
                if (!userData) continue;

                const userPkpSessionSigs = JSON.parse(userData);
                const userId = file.replace('.json', '');

                console.log(`Executing trade for user ${file}:`);
                // TODO: Call Xtreamly Backend API and enforce policy

            } catch (err) {
                console.error(`Error processing file ${file}:`, err);
            }

        }
    }
}

cron.schedule('* * * * *', async () => {
    console.log(`Running scheduled API call at ${new Date().toISOString()}`);
    try {
        await executeTradeForUsers()
    } catch (err) {
    }
});

app.post('/user_signup', async (req: Request<{}, {}, SignupRequestBody>, res: Response) => {
    const { id, pkpSessionSigs } = req.body;

    if (!id || !pkpSessionSigs) {
        return res.status(400).json({ error: 'Missing id or pkpSessionSigs' });
    }

    try {
        const filePath = `./users/${id}.json`
        await writePkpSessionSigsToFile(filePath, pkpSessionSigs);
        res.status(200).json({ success: true, message: `Saved to ${filePath}` });
    } catch (err) {
        console.error('Error writing file:', err);
        res.status(500).json({ error: 'Failed to write file' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});



