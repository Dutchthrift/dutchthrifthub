
import { db } from "./server/services/database";
import { sql } from "drizzle-orm";

async function check() {
    try {
        const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'email_threads' AND column_name = 'last_message_is_outbound';
    `);
        console.log("Column check result:", result);
    } catch (error) {
        console.error("Check failed:", error);
    }
    process.exit(0);
}

check();
