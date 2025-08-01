import { Client } from 'pg';
import dotenv from 'dotenv';
import { User } from './models';

dotenv.config();

export class UserRepository {
    private client: Client;

    constructor() {
        const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

        if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
            throw new Error('Missing database environment variables');
        }


        this.client = new Client({
            host: DB_HOST,
            user: DB_USER,
            password: DB_PASSWORD,
            database: DB_NAME,
            ssl: {
                rejectUnauthorized: false,
            },
            connectionTimeoutMillis: 5000,
        });
    }

    async connect() {
        try {
            await this.client.connect();
        } catch (e) {
            console.error("Failed to connect to the database:", e);
        }
    }

    async disconnect() {
        await this.client.end();
    }

    async initTable() {
        console.log('Initializing users table...');
        await this.client.query(`
              CREATE TABLE IF NOT EXISTS users (
                address TEXT PRIMARY KEY,
                session_sigs TEXT NOT NULL,
                lit_id TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
              )
            `
        );
    }

    async upsertUser(user: User): Promise<void> {
        const { address, lit_id, session_sigs } = user;
        await this.client.query(`
              INSERT INTO users (address, lit_id, session_sigs)
              VALUES ($1, $2, $3)
              ON CONFLICT (address) DO UPDATE SET
                session_sigs = EXCLUDED.session_sigs,
                lit_id = EXCLUDED.lit_id,
                updated_at = NOW()
          `,
            [address, lit_id, session_sigs]
        );
    }

    async getUser(address: string): Promise<User | null> {
        const res = await this.client.query(
            'SELECT * FROM users WHERE address = $1;',
            [address]
        );
        return res.rows[0] || null;
    }

    async getAllUsers(): Promise<User[] | null> {
        const res = await this.client.query(
            'SELECT * FROM users;'
        );
        return res.rows || null;
    }

}
