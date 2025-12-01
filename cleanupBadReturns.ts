import 'dotenv/config';
import { storage } from './server/storage';

async function cleanup() {
    try {
        console.log('🧹 Cleaning up returns...');
        const returns = await storage.getReturns();
        console.log(`Found ${returns.length} returns.`);

        for (const ret of returns) {
            console.log(`Deleting return ${ret.returnNumber} (ID: ${ret.id})...`);

            try {
                // Delete items first
                const items = await storage.getReturnItems(ret.id);
                console.log(`   - Deleting ${items.length} items...`);
                for (const item of items) {
                    await storage.deleteReturnItem(item.id);
                }

                // Delete return
                await storage.deleteReturn(ret.id);
                console.log('   ✅ Deleted return');
            } catch (e) {
                console.error(`   ❌ Failed to delete ${ret.returnNumber}:`, e.message);
            }
        }
        console.log('✨ Cleanup completed.');
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

cleanup();
