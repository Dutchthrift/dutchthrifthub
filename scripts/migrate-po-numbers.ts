/**
 * One-time migration script to convert PO numbers from old format (PO-2025-0016) to new format (PO-16)
 * Run this once with: npx tsx scripts/migrate-po-numbers.ts
 */

import { db } from "../server/db";
import { purchaseOrders } from "../shared/schema";

async function migratePONumbers() {
    console.log("🔄 Starting PO number migration...\n");

    // Get all purchase orders
    const allPOs = await db.select().from(purchaseOrders);

    let updated = 0;
    let skipped = 0;

    for (const po of allPOs) {
        if (!po.poNumber) {
            console.log(`⏭️  Skipped: ${po.id} (no PO number)`);
            skipped++;
            continue;
        }

        // Match old format: PO-YYYY-XXXX (e.g., PO-2025-0016)
        const oldFormatMatch = po.poNumber.match(/^PO-\d{4}-(\d+)$/);

        if (oldFormatMatch) {
            // Extract the number and remove leading zeros
            const number = parseInt(oldFormatMatch[1], 10);
            const newPoNumber = `PO-${number}`;

            console.log(`✅ Converting: ${po.poNumber} → ${newPoNumber}`);

            await db.update(purchaseOrders)
                .set({ poNumber: newPoNumber })
                .where(eq(purchaseOrders.id, po.id));

            updated++;
        } else {
            console.log(`⏭️  Skipped: ${po.poNumber} (already new format or unknown format)`);
            skipped++;
        }
    }

    console.log(`\n✨ Migration complete!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);

    process.exit(0);
}

// Import eq from drizzle
import { eq } from "drizzle-orm";

migratePONumbers().catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
});
