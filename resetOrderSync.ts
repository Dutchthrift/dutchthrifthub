import 'dotenv/config';
import { storage } from './server/storage';

async function resetOrderSync() {
    try {
        const LAST_SYNC_KEY = "shopify_last_order_sync_timestamp";
        const targetDate = new Date('2025-10-01T00:00:00Z');

        console.log(`🔄 Resetting ${LAST_SYNC_KEY} to ${targetDate.toISOString()}...`);

        await storage.setSystemSetting(LAST_SYNC_KEY, targetDate.toISOString());

        console.log('✅ Successfully reset sync timestamp.');
        console.log('Next incremental sync will fetch orders from 1 October 2025.');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

resetOrderSync();
