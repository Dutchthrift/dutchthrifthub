// Check and delete the last sync setting
async function checkAndResetSyncSetting() {
    try {
        console.log('🔍 Checking sync settings in database...\n');

        // Get settings via inspecting the sync behavior
        // Since we saw total: 0, the sync is likely using a recent lastSyncTime

        console.log('Let me delete the shopify_returns_last_sync setting entirely');
        console.log('This will force the sync to use the default date (16 Nov 2025)\n');

        // We need to make a SQL call or use the storage API
        // For now, let's just trigger a fullSync instead

        console.log('🔄 Triggering FULL SYNC (ignores last sync time)...\n');

        const response = await fetch('http://localhost:5000/api/shopify/sync-returns?fullSync=true', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log(`Status: ${response.status} ${response.statusText}\n`);

        const result = await response.json();

        console.log('Response:');
        console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkAndResetSyncSetting();
