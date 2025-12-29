import 'dotenv/config';
import { db } from './server/services/database';
import { sql } from 'drizzle-orm';

async function migrate() {
    try {
        console.log("Starting migration...");

        // 1. Convert non-json content to a json object format (as text)
        await db.execute(sql`
            UPDATE email_threads 
            SET suggested_reply = json_build_object('customer', suggested_reply, 'english', '')::text 
            WHERE suggested_reply IS NOT NULL 
            AND (suggested_reply !~ '^\{.*\}' OR suggested_reply IS NULL);
        `);
        console.log("Step 1 complete: Converted plain text to JSON objects.");

        // 2. Alter column type to jsonb
        await db.execute(sql`
            ALTER TABLE email_threads 
            ALTER COLUMN suggested_reply TYPE jsonb 
            USING suggested_reply::jsonb;
        `);
        console.log("Step 2 complete: Altered column type to jsonb.");

        console.log("Migration successful!");
    } catch (err) {
        console.error("Migration failed:", err);
    }
    process.exit(0);
}

migrate();
