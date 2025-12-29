
import dotenv from "dotenv";
dotenv.config();

import { db } from "./server/services/database";
import { emailThreads, emailMessages } from "./shared/schema";
import { eq, desc } from "drizzle-orm";

console.log("CWD:", process.cwd());
console.log("DATABASE_URL present:", !!process.env.DATABASE_URL);

async function migrate() {
    console.log("Starting migration of lastMessageIsOutbound (v2)...");

    const threads = await db.select().from(emailThreads);
    console.log(`Found ${threads.length} threads to check.`);

    let updatedCount = 0;
    const gmailUser = process.env.GMAIL_USER || '';

    // Comprehensive list of company emails (same as gmailService.ts)
    const COMPANY_EMAILS = [
        'contact@dutchthrift.com',
        'info@dutchthrift.com',
        'noreply@dutchthrift.com',
        'support@dutchthrift.com',
        'me'
    ];

    for (const thread of threads) {
        const messages = await db
            .select()
            .from(emailMessages)
            .where(eq(emailMessages.threadId, thread.id))
            .orderBy(desc(emailMessages.sentAt))
            .limit(1);

        if (messages.length > 0) {
            const lastMsg = messages[0];
            const fromEmail = lastMsg.fromEmail.toLowerCase();

            // Check if last message is outbound
            // 1. Is it labelled SENT? (We don't easily have labels here unless we query labels field if available, 
            // but emailMessages schema doesn't seem to store labelIds per message easily, only on thread.
            // Wait, thread has labels.
            // But thread labels apply to the whole thread.
            // Best proxy is sender email.)

            const isFromCompany = [...COMPANY_EMAILS, gmailUser].filter(Boolean)
                .some(e => fromEmail.includes(e.toLowerCase()));

            // Update the thread
            await db.update(emailThreads)
                .set({ lastMessageIsOutbound: isFromCompany })
                .where(eq(emailThreads.id, thread.id));

            updatedCount++;
        }
    }

    console.log(`Migration complete. Updated ${updatedCount} threads.`);
    process.exit(0);
}

migrate().catch(e => {
    console.error("Migration failed:", e);
    process.exit(1);
});
