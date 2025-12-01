async function debugSync() {
    try {
        console.log('🔄 Triggering Returns Sync with fullSync...\n');

        const response = await fetch('http://localhost:5000/api/shopify/sync-returns?fullSync=true', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();
        console.log('📊 Sync Result:');
        console.log(JSON.stringify(result, null, 2));

        console.log('\n🔍 Checking returns in database...');
        const returnsResponse = await fetch('http://localhost:5000/api/returns');
        const returns = await returnsResponse.json();
        console.log(`Found ${returns.length} returns in DB`);

        if (returns.length > 0) {
            console.log('\nReturns:');
            returns.forEach(r => {
                console.log(`- ${r.returnNumber} (Shopify: ${r.shopifyReturnName}) - Status: ${r.status}`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugSync();
