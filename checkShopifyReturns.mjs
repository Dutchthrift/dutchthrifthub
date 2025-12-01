import { shopifyClient } from './server/services/shopifyClient.js';
import { storage } from './server/storage.js';

async function checkShopifyReturn() {
    try {
        console.log('🔍 Checking Shopify for return of order #8972...\n');

        // Get last sync time
        const lastSync = await storage.getSetting('shopify_returns_last_sync');
        console.log(`📅 Last sync time in database: ${lastSync || 'Never'}`);
        console.log(`   Converting to local time: ${lastSync ? new Date(lastSync).toLocaleString('nl-NL') : 'Never'}\n`);

        // Check reference time
        const referenceDate = new Date('2025-11-26T12:35:00+01:00');
        console.log(`⏰ Return was created at: ${referenceDate.toLocaleString('nl-NL')} (${referenceDate.toISOString()})`);

        if (lastSync) {
            const lastSyncDate = new Date(lastSync);
            if (lastSyncDate > referenceDate) {
                console.log(`⚠️  WARNING: Last sync (${lastSyncDate.toLocaleString('nl-NL')}) is AFTER the return creation time!`);
                console.log(`   This means the return won't be picked up by incremental sync.\n`);
            } else {
                console.log(`✅ Last sync is before return creation, so it should be picked up.\n`);
            }
        }

        // Fetch returns from Shopify since yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 2);

        console.log(`📦 Fetching Shopify returns since: ${yesterday.toLocaleString('nl-NL')}...\n`);

        const returns = await shopifyClient.getReturnsSinceDate(yesterday);

        console.log(`Found ${returns.length} returns from Shopify:\n`);

        for (const ret of returns) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`Name: ${ret.name}`);
            console.log(`Order: ${ret.order.name}`);
            console.log(`Status: ${ret.status}`);
            console.log(`Shopify ID: ${ret.id}`);

            // Check if exists in our database
            const existing = await storage.getReturnByShopifyId(ret.id);
            if (existing) {
                console.log(`✅ EXISTS in database as: ${existing.returnNumber}`);
            } else {
                console.log(`❌ NOT in database yet`);
            }
            console.log('');
        }

        // Get all returns from our database
        console.log('\n📋 Returns currently in our database:');
        const dbReturns = await storage.getReturns();
        console.log(`Total: ${dbReturns.length}\n`);

        for (const ret of dbReturns) {
            console.log(`${ret.returnNumber}: Shopify ${ret.shopifyReturnName || 'N/A'} (Status: ${ret.status})`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

checkShopifyReturn();
