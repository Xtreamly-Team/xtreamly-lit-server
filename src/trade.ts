import dotenv from 'dotenv';
import { User } from './models';
import { LitNodeClient } from '@lit-protocol/lit-node-client';

dotenv.config();

export class Trader {
    litNodeClient: LitNodeClient
    litTradeExecutor: LitTradeExecutor

    constructor(litNodeClient: LitNodeClient, litTradeExecutor: LitTradeExecutor = new DummyLitTradeExecutor()) {
        this.litNodeClient = litNodeClient;
        this.litTradeExecutor = litTradeExecutor
    }

    async shouldTrade(symbol: string, horizon: number = 60): Promise<TradeParams | null> {
        console.log("Checking volatility...");
        const volatilityPrediction = await fetch(`https://api.xtreamly.io/volatility_prediction_pos?symbol=${symbol}&horizon=${horizon}`, {
            method: 'GET',
            headers: {
                'x-api-key': process.env.XTREAMLY_API_KEY,
            },
        })
        const volatility = (await volatilityPrediction.json())['volatility'];
        console.log("Volatility prediction:", volatility);
        // TODO: Call Xtreamly Backend API and enforce policy
        if (volatility > 0.008260869599999996) {
            console.log(`Volatility is high: ${volatility}. Should trade`);
            return {
                symbol: symbol,
                side: Math.random() > 0.5 ? 'buy' : 'sell',
                amount: Math.floor(Math.random()) + 1
            }
        }
        return null
    }

    async tradeForUsers(users: User[], tradeParams: TradeParams) {
        for (const user of users) {
            try {
                console.log(`Executing trade for user ${user.address}:`);
                this.litTradeExecutor.excuteTrade(
                    {
                        litNodeClient: this.litNodeClient,
                        lit_id: user.lit_id,
                        session_sigs: user.session_sigs
                    },
                    tradeParams
                )
            } catch (err) {
                console.error(err);
            }

        }
    }

}

export interface LitExecutorParams {
    litNodeClient: LitNodeClient;
    lit_id: string;
    session_sigs: any;
}

export interface TradeParams {
    symbol: string;
    side: 'buy' | 'sell';
    amount: number;
}

export abstract class LitTradeExecutor {
    abstract excuteTrade(executorParams: LitExecutorParams, tradeParams: TradeParams): Promise<void>
}

class DummyLitTradeExecutor extends LitTradeExecutor {
    async excuteTrade(executorParams: LitExecutorParams, tradeParams: TradeParams): Promise<void> {
        console.log(`Dummy trade executed for user ${executorParams.lit_id} for symbol ${tradeParams.symbol} with side ${tradeParams.side} and amount ${tradeParams.amount}`);
    }
}
