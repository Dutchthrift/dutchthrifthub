
import 'dotenv/config';
import { db } from "./services/supabaseClient";
import { caseNotes, internalNotes, notes } from "@shared/schema";
import { eq } from "drizzle-orm";

async function migrateNotes() {
    console.log("🚀 Starting notes migration...");

    try {
        // 1. Migrate Case Notes
        console.log("📦 Migrating case_notes...");
        const allCaseNotes = await db.select().from(caseNotes);
        console.log(`Found ${allCaseNotes.length} case notes.`);

        let caseNotesMigrated = 0;
        for (const note of allCaseNotes) {
            await db.insert(notes).values({
                entityType: "case",
                entityId: note.caseId,
                content: note.content,
                authorId: note.createdBy,
                createdAt: note.createdAt,
                updatedAt: note.updatedAt,
                visibility: "internal",
                source: "migration_case_notes",
            });
            caseNotesMigrated++;
        }
        console.log(`✅ Migrated ${caseNotesMigrated} case notes.`);

        // 2. Migrate Internal Notes
        console.log("📦 Migrating internal_notes...");
        const allInternalNotes = await db.select().from(internalNotes);
        console.log(`Found ${allInternalNotes.length} internal notes.`);

        let internalNotesMigrated = 0;
        let skippedNotes = 0;

        for (const note of allInternalNotes) {
            let entityType: "customer" | "order" | "repair" | "emailThread" | "case" | "return" | null = null;
            let entityId: string | null = null;

            if (note.caseId) {
                entityType = "case";
                entityId = note.caseId;
            } else if (note.orderId) {
                entityType = "order";
                entityId = note.orderId;
            } else if (note.customerId) {
                entityType = "customer";
                entityId = note.customerId;
            } else if (note.repairId) {
                entityType = "repair";
                entityId = note.repairId;
            } else if (note.emailThreadId) {
                entityType = "emailThread";
                entityId = note.emailThreadId;
            } else if (note.returnId) {
                entityType = "return";
                entityId = note.returnId;
            }

            if (entityType && entityId) {
                await db.insert(notes).values({
                    entityType: entityType,
                    entityId: entityId,
                    content: note.content,
                    authorId: note.authorId,
                    createdAt: note.createdAt,
                    updatedAt: note.updatedAt,
                    visibility: "internal",
                    source: "migration_internal_notes",
                });
                internalNotesMigrated++;
            } else {
                console.warn(`⚠️ Skipping internal note ${note.id}: No associated entity found. Data:`, JSON.stringify(note, null, 2));
                skippedNotes++;
            }
        }
        console.log(`✅ Migrated ${internalNotesMigrated} internal notes.`);
        if (skippedNotes > 0) {
            console.log(`⚠️ Skipped ${skippedNotes} notes due to missing entity links.`);
        }

        console.log("🎉 Migration completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
}

migrateNotes();
