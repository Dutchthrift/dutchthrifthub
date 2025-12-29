import 'dotenv/config';
import { db } from './server/services/database';
import { sql } from 'drizzle-orm';

async function check() {
    try {
        const typeRes = await db.execute(sql`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'email_threads' AND column_name = 'suggested_reply'
        `);
        console.log("Column Type Info:", JSON.stringify(typeRes, null, 2));

        const dataRes = await db.execute(sql`
            SELECT id, suggested_reply 
            FROM email_threads 
            WHERE suggested_reply IS NOT NULL 
            LIMIT 5
        `);
        console.log("Sample Data:", JSON.stringify(dataRes, null, 2));
    } catch (err) {
        console.error("Check failed:", err);
    }
    process.exit(0);
}

check();
