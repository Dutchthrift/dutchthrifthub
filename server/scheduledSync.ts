import cron from 'node-cron';
import { log } from './vite';

export function startScheduledSync() {
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      log('🔄 [Auto-Sync] Starting scheduled Shopify sync (orders + returns)...');

      // Sync orders first
      const ordersResponse = await fetch('http://localhost:5000/api/shopify/sync-incremental', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!ordersResponse.ok) {
        throw new Error(`Orders sync failed with status: ${ordersResponse.status}`);
      }

      const ordersResult = await ordersResponse.json();
      log(`✅ [Auto-Sync] Orders: ${ordersResult.stats?.created || 0} created, ${ordersResult.stats?.updated || 0} updated`);

      // Then sync returns
      const returnsResponse = await fetch('http://localhost:5000/api/shopify/sync-returns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: This endpoint requires auth, but we're calling it internally
          // You might need to add an internal auth token or bypass auth for localhost
        },
      });

      if (returnsResponse.ok) {
        const returnsResult = await returnsResponse.json();
        log(`✅ [Auto-Sync] Returns: ${returnsResult.created || 0} created, ${returnsResult.updated || 0} updated`);
      } else {
        log(`⚠️ [Auto-Sync] Returns sync failed with status: ${returnsResponse.status}`);
      }

      if (ordersResult.errors && ordersResult.errors.length > 0) {
        log(`⚠️ [Auto-Sync] Encountered ${ordersResult.errors.length} errors during sync`);
      }
    } catch (error) {
      log(`❌ [Auto-Sync] Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  log('⏰ Scheduled Shopify sync enabled - will run every 5 minutes');
}
