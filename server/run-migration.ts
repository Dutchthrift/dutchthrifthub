import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

async function runMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Connected to database');

        const migrationFile = process.argv[2] || 'migrations/0004_add_todo_tables.sql';
        const migrationPath = path.join(__dirname, '..', migrationFile);
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Running migration:', migrationPath);
        console.log('SQL:', sql);

        await client.query(sql);

        console.log('✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
