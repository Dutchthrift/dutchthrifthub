import 'dotenv/config';
import { storage } from './server/storage';

async function checkReturns() {
    try {
        console.log('🔍 Checking returns in DB...\n');
        const returns = await storage.getReturns();
        console.log(`Found ${returns.length} returns:`);

        for (const ret of returns) {
            console.log(`\n----------------------------------------`);
            console.log(`Return: ${ret.returnNumber} (Shopify: ${ret.shopifyReturnName})`);
            console.log(`Status: ${ret.status}`);
            console.log(`Order ID: ${ret.orderId ? '✅ Linked' : '❌ Missing'}`);
            console.log(`Customer ID: ${ret.customerId ? '✅ Linked' : '❌ Missing'}`);

            if (ret.orderId) {
                const order = await storage.getOrder(ret.orderId);
                console.log(`Linked Order: ${order?.orderNumber} (${order?.orderDate})`);
            }

            const items = await storage.getReturnItems(ret.id);
            console.log(`Items (${items.length}):`);
            for (const item of items) {
                console.log(`  - ${item.productName} (Price: ${item.unitPrice})`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

checkReturns();
