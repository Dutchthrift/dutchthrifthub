// Simple script to check returns via API
async function checkReturns() {
    try {
        console.log('🔍 Fetching returns from API...\n');

        const response = await fetch('http://localhost:5000/api/returns');

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const returns = await response.json();

        console.log(`📋 Total returns: ${returns.length}\n`);

        for (const ret of returns) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`Return Number: ${ret.returnNumber}`);
            console.log(`Status: ${ret.status}`);
            console.log(`Shopify Return ID: ${ret.shopifyReturnId || 'N/A'}`);
            console.log(`Shopify Return Name: ${ret.shopifyReturnName || 'N/A'}`);
            console.log(`Order ID: ${ret.orderId || 'N/A'}`);
            console.log(`Synced At: ${ret.syncedAt || 'Never synced'}`);
            console.log(`Created At: ${ret.createdAt}`);
            console.log('');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkReturns();
