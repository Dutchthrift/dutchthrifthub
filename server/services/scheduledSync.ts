import type { IStorage } from '../storage';
import { syncShopifyOrders } from './shopifyOrdersSync';
import { syncShopifyReturns } from './shopifyReturnsSync';

/**
 * Scheduled sync service
 * Automatically syncs orders and returns from Shopify at regular intervals
 */

let syncInterval: NodeJS.Timeout | null = null;
let isSyncing = false;

/**
 * Start scheduled sync
 * @param storage Storage instance
 * @param intervalMinutes Interval in minutes (default: 10)
 */
export function startScheduledSync(storage: IStorage, intervalMinutes: number = 10) {
    if (syncInterval) {
        console.log('⏰ Scheduled sync already running');
        return;
    }

    const intervalMs = intervalMinutes * 60 * 1000;

    console.log(`⏰ Starting scheduled Shopify sync every ${intervalMinutes} minutes`);

    // Run immediately on startup
    performSync(storage);

    // Then schedule regular syncs
    syncInterval = setInterval(() => {
        performSync(storage);
    }, intervalMs);
}

/**
 * Stop scheduled sync
 */
export function stopScheduledSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
        console.log('⏹️  Stopped scheduled sync');
    }
}

/**
 * Perform a sync cycle
 */
async function performSync(storage: IStorage) {
    if (isSyncing) {
        console.log('⏭️  Skipping sync - previous sync still running');
        return;
    }

    isSyncing = true;
    const startTime = Date.now();

    try {
        console.log('🔄 Starting scheduled sync...');

        // Sync orders first (so returns can link to them)
        console.log('📦 Syncing orders...');
        const ordersResult = await syncShopifyOrders(storage);
        console.log(`✅ Orders: ${ordersResult.created} created, ${ordersResult.updated} updated`);

        // Then sync returns
        console.log('↩️  Syncing returns...');
        const returnsResult = await syncShopifyReturns(storage);
        console.log(`✅ Returns: ${returnsResult.created} created, ${returnsResult.updated} updated`);

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ Scheduled sync completed in ${duration}s`);

    } catch (error) {
        console.error('❌ Scheduled sync error:', error);
    } finally {
        isSyncing = false;
    }
}

/**
 * Get sync status
 */
export function getSyncStatus() {
    return {
        running: syncInterval !== null,
        syncing: isSyncing,
    };
}
