import cron from 'node-cron';
import { log } from './vite';

export function startScheduledSync() {
  // Run every hour at minute 0 (e.g., 1:00, 2:00, 3:00...)
  cron.schedule('0 * * * *', async () => {
    try {
      log('🔄 [Auto-Sync] Starting scheduled Shopify sync...');
      
      // Call the incremental sync endpoint
      const response = await fetch('http://localhost:5000/api/shopify/sync-incremental', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Sync failed with status: ${response.status}`);
      }

      const result = await response.json();
      
      log(`✅ [Auto-Sync] Completed! Synced: ${result.stats?.synced || 0} orders, Created: ${result.stats?.created || 0}, Updated: ${result.stats?.updated || 0}`);
      
      if (result.errors && result.errors.length > 0) {
        log(`⚠️ [Auto-Sync] Encountered ${result.errors.length} errors during sync`);
      }
    } catch (error) {
      log(`❌ [Auto-Sync] Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  log('⏰ Scheduled Shopify sync enabled - will run every hour');
}
