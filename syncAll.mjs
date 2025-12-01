// Sync both orders AND returns
async function syncEverything() {
    try {
        console.log('🔄 Step 1: Syncing ORDERS first...\n');

        const ordersResponse = await fetch('http://localhost:5000/api/shopify/sync-incremental', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const ordersResult = await ordersResponse.json();
        console.log('Orders Sync Result:');
        console.log(JSON.stringify(ordersResult, null, 2));
        console.log('\n----------------------------------------\n');

        console.log('🔄 Step 2: Syncing RETURNS (full sync to get all)...\n');

        const returnsResponse = await fetch('http://localhost:5000/api/shopify/sync-returns?fullSync=true', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const returnsResult = await returnsResponse.json();
        console.log('Returns Sync Result:');
        console.log(JSON.stringify(returnsResult, null, 2));

        console.log('\n✅ Sync completed!');
        console.log(`   Orders: ${ordersResult.stats?.created || 0} created, ${ordersResult.stats?.updated || 0} updated`);
        console.log(`   Returns: ${returnsResult.created || 0} created, ${returnsResult.updated || 0} updated`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

syncEverything();
