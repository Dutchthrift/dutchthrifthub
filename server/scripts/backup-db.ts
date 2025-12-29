import dotenv from 'dotenv';
dotenv.config();
import { db } from '../services/database';
import * as schema from "@shared/schema";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function backup() {
    const backupDir = path.join(__dirname, "../../backups");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const currentBackupDir = path.join(backupDir, timestamp);

    console.log(`Creating backup in: ${currentBackupDir}`);

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
    }
    if (!fs.existsSync(currentBackupDir)) {
        fs.mkdirSync(currentBackupDir);
    }

    // List of tables to backup
    const tables = [
        { name: "users", table: schema.users },
        { name: "customers", table: schema.customers },
        { name: "orders", table: schema.orders },

        // Mail related - Metadata only
        { name: "email_threads", table: schema.emailThreads },
        { name: "email_links", table: schema.emailLinks },
        // Skipped content tables: emails, email_messages, email_attachments

        // Case related
        { name: "cases", table: schema.cases },
        { name: "case_links", table: schema.caseLinks },
        { name: "case_notes", table: schema.caseNotes },
        { name: "case_events", table: schema.caseEvents },
        { name: "case_items", table: schema.caseItems },

        // Other core entities
        { name: "repairs", table: schema.repairs },
        { name: "todos", table: schema.todos },
        { name: "returns", table: schema.returns },
    ];

    try {
        for (const { name, table } of tables) {
            console.log(`Backing up ${name}...`);
            const data = await db.select().from(table);
            fs.writeFileSync(
                path.join(currentBackupDir, `${name}.json`),
                JSON.stringify(data, null, 2)
            );
            console.log(`- ${data.length} records saved.`);
        }
        console.log("✅ Backup completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Backup failed:", error);
        process.exit(1);
    }
}

backup();
