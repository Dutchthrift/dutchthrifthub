import { storage } from './storage';

async function checkReturns() {
    try {
        console.log('🔍 Checking all returns in database...\n');

        const returns = await storage.getReturns();

        console.log(`📋 Total returns in database: ${returns.length}\n`);

        for (const ret of returns) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`Return Number: ${ret.returnNumber}`);
            console.log(`Status: ${ret.status}`);
            console.log(`Shopify Return ID: ${ret.shopifyReturnId || 'N/A'}`);
            console.log(`Shopify Return Name: ${ret.shopifyReturnName || 'N/A'}`);
            console.log(`Order ID: ${ret.orderId || 'N/A'}`);
            console.log(`Customer ID: ${ret.customerId || 'N/A'}`);
            console.log(`Requested At: ${ret.requestedAt}`);
            console.log(`Synced At: ${ret.syncedAt || 'Never synced'}`);
            console.log(`Created At: ${ret.createdAt}`);
            console.log('');
        }

        // Check settings
        console.log('\n🔧 Settings:');
        const lastSync = await storage.getSetting('shopify_returns_last_sync');
        console.log(`Last sync time: ${lastSync || 'Never'}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkReturns();
