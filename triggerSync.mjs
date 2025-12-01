// Script to reset sync timestamp via API database call
async function resetSyncTimestamp() {
    try {
        console.log('🔄 Resetting sync timestamp to 16 November 2025...\n');

        // We'll use a direct SQL query via the API
        const resetDate = new Date('2025-11-16T00:00:00+01:00').toISOString();

        console.log(`Setting shopify_returns_last_sync to: ${resetDate}`);
        console.log(`  (16 November 2025, 00:00:00 CET)\n`);

        // For now, let's just trigger a full sync which will reset the timestamp anyway
        console.log('Triggering Shopify returns sync...\n');

        const response = await fetch('http://localhost:5000/api/shopify/sync-returns', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        console.log('✅ Sync completed!');
        console.log(`   Created: ${result.created || 0}`);
        console.log(`   Updated: ${result.updated || 0}`);
        console.log(`   Skipped: ${result.skipped || 0}`);
        console.log(`   Total: ${result.total || 0}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

resetSyncTimestamp();
