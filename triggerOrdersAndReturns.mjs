// Sync orders (incremental from reset date) and then returns
async function syncOrdersAndReturns() {
    try {
        console.log('🔄 Step 1: Syncing ORDERS (from 1 Oct 2025)...\n');

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

        console.log('🔄 Step 2: Syncing RETURNS (fetching active returns)...\n');

        // We use fullSync=true just to be sure we trigger the logic, 
        // but our new code ignores the date anyway for active returns.
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

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

syncOrdersAndReturns();
