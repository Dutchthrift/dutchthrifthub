// Delete sync settings and do full sync
async function resetAndSync() {
    try {
        console.log('🔄 Triggering FULL sync for both orders and returns...\n');
        console.log('This will sync going back 1 year for orders, 1 year for returns\n');

        // First, sync orders with a date range that includes our orders
        console.log('Step 1: Syncing orders (with created_at_min)...\n');

        const ordersResponse = await fetch('http://localhost:5000/api/shopify/sync-incremental?created_at_min=2025-10-01T00:00:00Z', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const ordersResult = await ordersResponse.json();
        console.log('Orders Result:');
        console.log(JSON.stringify(ordersResult, null, 2));

        if (ordersResult.stats) {
            console.log(`\n✅ Orders synced: ${ordersResult.stats.created} created, ${ordersResult.stats.updated} updated\n`);
        }

        // Now sync returns with fullSync=true
        console.log('Step 2: Syncing returns (fullSync=true)...\n');

        const returnsResponse = await fetch('http://localhost:5000/api/shopify/sync-returns?fullSync=true', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const returnsResult = await returnsResponse.json();
        console.log('Returns Result:');
        console.log(JSON.stringify(returnsResult, null, 2));

        console.log(`\n✅ Returns synced: ${returnsResult.created || 0} created, ${returnsResult.updated || 0} updated`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

resetAndSync();
