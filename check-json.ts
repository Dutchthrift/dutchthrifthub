import 'dotenv/config';
import { db } from './server/services/database';
import { sql } from 'drizzle-orm';

async function check() {
    try {
        const res = await db.execute(sql`
            SELECT id, suggested_reply, 
            CASE 
                WHEN suggested_reply IS NULL THEN 'null'
                WHEN suggested_reply ~ '^\{.*\}$' THEN 'looks_like_json' 
                ELSE 'plain_text' 
            END as format
            FROM email_threads 
            WHERE suggested_reply IS NOT NULL
        `);
        console.log("Format stats:", JSON.stringify(res, null, 2));
    } catch (err) {
        console.error("Check failed:", err);
    }
    process.exit(0);
}

check();
