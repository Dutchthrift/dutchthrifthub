import type { IStorage } from '../storage';
import { shopifyClient } from './shopifyClient';
import type { InsertOrder } from '@shared/schema';

/**
 * Sync Shopify orders to local database
 */
export async function syncShopifyOrders(
    storage: IStorage,
    onProgress?: (current: number, total: number, message: string) => void
) {
    console.log('🔄 Starting Shopify orders synchronization...');

    const lastSyncStr = await storage.getSetting('shopify_orders_last_sync');
    const sinceDate = lastSyncStr
        ? new Date(lastSyncStr)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days

    console.log(`Fetching orders created/updated since: ${sinceDate.toISOString()}`);

    const shopifyOrders = await shopifyClient.getOrdersSinceDate(sinceDate, (processed) => {
        onProgress?.(processed, 0, `Ophalen order ${processed} van Shopify...`);
    });

    console.log(`📦 Retrieved ${shopifyOrders.length} orders from Shopify`);

    let created = 0;
    let updated = 0;

    for (let i = 0; i < shopifyOrders.length; i++) {
        const order: any = shopifyOrders[i];

        onProgress?.(i + 1, shopifyOrders.length, `Verwerken order ${i + 1}/${shopifyOrders.length}...`);

        try {
            const existing = await storage.getOrderByShopifyId(order.id.toString());

            // Bypass strict typing for now to resolve persistent field name mismatches
            const orderData: any = {
                shopifyOrderId: order.id.toString(),
                orderNumber: order.order_number.toString(),
                customerEmail: order.email,
                totalAmount: Math.round(parseFloat(order.total_price) * 100),
                currency: order.currency,
                financialStatus: order.financial_status,
                fulfillmentStatus: order.fulfillment_status || 'unfulfilled',
                orderDate: new Date(order.created_at),
                updatedAt: new Date(order.updated_at),
                customerId: null,
                status: 'pending'
            };

            if (existing) {
                await storage.updateOrder(existing.id, orderData);
                updated++;
            } else {
                await storage.createOrder(orderData);
                created++;
            }
        } catch (error) {
            console.error(`❌ Error processing order ${order.order_number || 'unknown'}:`, error);
        }
    }

    await storage.setSetting('shopify_orders_last_sync', new Date().toISOString());

    const summary = {
        total: shopifyOrders.length,
        created,
        updated
    };

    console.log('✅ Shopify orders sync completed:', summary);
    return summary;
}
