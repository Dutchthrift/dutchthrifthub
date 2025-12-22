
import dotenv from "dotenv";
dotenv.config();
import { db } from "./server/services/database";
import { emailMessages, emailThreads } from "./shared/schema";
import { sql, ilike, eq, desc } from "drizzle-orm";

async function analyze() {
    console.log("Analyzing sender emails...");

    console.log("Searching for thread 'Order #8878 confirmed'...");

    // Find the thread
    const threads = await db.select().from(emailThreads).where(ilike(emailThreads.subject, "%Order #8878 confirmed%"));

    if (threads.length === 0) {
        console.log("Thread not found.");
        return;
    }

    console.log(`Found ${threads.length} threads.`);
    const threadId = threads[0].id; // Assuming first one is the one

    console.log(`Analyzing thread ID: ${threadId}`);

    const messages = await db
        .select()
        .from(emailMessages)
        .where(eq(emailMessages.threadId, threadId))
        .orderBy(desc(emailMessages.sentAt)); // Newest first

    console.log("Messages:");

    let output = "";
    for (const m of messages) {
        const line = `[${m.sentAt}] From: [${m.fromEmail}] "${m.fromName}" - Snippet: ${m.snippet?.substring(0, 30)}...\n`;
        console.log(line);
        output += line;
    }

    const fs = await import('fs');
    fs.writeFileSync('sender-analysis.txt', output);
    console.log("Wrote analysis to sender-analysis.txt");
    process.exit(0);
}

analyze();

