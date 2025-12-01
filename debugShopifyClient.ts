import 'dotenv/config';
import { shopifyClient } from './server/services/shopifyClient';
import { storage } from './server/storage';

async function debugSync() {
    try {
        console.log('🔍 Debugging Shopify Client directly...\n');
        console.log('Environment check:');
        console.log('- SHOPIFY_SHOP_DOMAIN:', process.env.SHOPIFY_SHOP_DOMAIN ? 'Set' : 'Missing');
        console.log('- SHOPIFY_ACCESS_TOKEN:', process.env.SHOPIFY_ACCESS_TOKEN ? 'Set' : 'Missing');

        // Use a dummy date, it should be ignored by our new logic
        const sinceDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

        console.log(`Calling getReturnsSinceDate with ${sinceDate.toISOString()}...`);

        const returns = await shopifyClient.getReturnsSinceDate(sinceDate, (processed) => {
            process.stdout.write(`\rProcessed: ${processed}`);
        });

        console.log(`\n\n✅ Found ${returns.length} returns:`);

        for (const ret of returns) {
            console.log(`- ${ret.name} (${ret.status})`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

debugSync();
