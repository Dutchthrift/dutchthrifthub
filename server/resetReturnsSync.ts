
import { storage } from './storage';

async function resetSync() {
    try {
        // Set to 16 November 2025 00:00:00 to pick up all returns since then
        const resetDate = new Date('2025-11-16T00:00:00+01:00').toISOString();
        await storage.setSetting('shopify_returns_last_sync', resetDate);
        console.log(`✅ Successfully reset shopify_returns_last_sync to: ${resetDate}`);
        console.log(`   (16 November 2025, 00:00:00)`);
        console.log('Future syncs will pick up returns updated after this time.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to reset sync setting:', error);
        process.exit(1);
    }
}

resetSync();
