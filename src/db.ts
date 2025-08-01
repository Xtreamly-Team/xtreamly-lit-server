import { Client } from 'pg';
import dotenv from 'dotenv';
import { User } from './models';

dotenv.config();

export class UserRepository {
    private client: Client;

    constructor() {
        const { PG_CONN_STRING, PG_USER, PG_PASSWORD } = process.env;

        if (!PG_CONN_STRING || !PG_USER || !PG_PASSWORD) {
            throw new Error('Missing database environment variables');
        }

        this.client = new Client({
            connectionString: PG_CONN_STRING,
            user: PG_USER,
            password: PG_PASSWORD,
        });
    }

    async connect() {
        await this.client.connect();
    }

    async disconnect() {
        await this.client.end();
    }

    async initTable() {
        await this.client.query(
            `
              CREATE TABLE IF NOT EXISTS users (
                address TEXT PRIMARY KEY,
                session_sigs TEXT NOT NULL,
                lit_id TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
              )
            `
        );
    }

    async upsertUser(user: User): Promise<void> {
        const { address, session_sigs } = user;
        await this.client.query(
            `
              INSERT INTO users (address, session_sigs)
              VALUES ($1, $2)
              ON CONFLICT (address) DO UPDATE SET
                session_sigs = EXCLUDED.session_sigs,
                lit_id = EXCLUDED.lit_id,
                updated_at = NOW();
          `,
            [address, session_sigs]
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
