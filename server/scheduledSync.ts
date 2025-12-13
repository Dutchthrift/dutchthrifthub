import cron from 'node-cron';
import { log } from './vite';
import { incrementalEmailSync } from './services/incrementalEmailSync';

export function startScheduledSync() {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      log('🔄 [Auto-Sync] Starting scheduled sync (Shopify + Emails)...');

      // Sync Shopify orders first
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

      // Then sync Shopify returns
      const returnsResponse = await fetch('http://localhost:5000/api/shopify/sync-returns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (returnsResponse.ok) {
        const returnsResult = await returnsResponse.json();
        log(`✅ [Auto-Sync] Returns: ${returnsResult.created || 0} created, ${returnsResult.updated || 0} updated`);
      } else {
        log(`⚠️ [Auto-Sync] Returns sync failed with status: ${returnsResponse.status}`);
      }

      // Finally sync emails (incremental - only new emails)
      try {
        const emailResult = await incrementalEmailSync();
        if (emailResult.synced > 0) {
          log(`✅ [Auto-Sync] Emails: ${emailResult.synced} new emails synced`);
        }
        if (emailResult.errors.length > 0) {
          log(`⚠️ [Auto-Sync] Email sync had ${emailResult.errors.length} errors`);
        }
      } catch (emailError) {
        log(`⚠️ [Auto-Sync] Email sync failed: ${emailError instanceof Error ? emailError.message : 'Unknown error'}`);
      }

      if (ordersResult.errors && ordersResult.errors.length > 0) {
        log(`⚠️ [Auto-Sync] Encountered ${ordersResult.errors.length} errors during sync`);
      }
    } catch (error) {
      log(`❌ [Auto-Sync] Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  log('⏰ Scheduled sync enabled - Shopify + Emails every 5 minutes');
}
