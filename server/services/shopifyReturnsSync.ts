import type { IStorage } from '../storage';
import { shopifyClient, type ShopifyReturn } from './shopifyClient';
import type { InsertReturn, InsertReturnItem } from '@shared/schema';

// Status mapping from Shopify to our schema
// Database enum values: nieuw, onderweg, ontvangen_controle, akkoord_terugbetaling, vermiste_pakketten, wachten_klant, opnieuw_versturen, klaar, niet_ontvangen
const SHOPIFY_STATUS_MAP: Record<string, string> = {
    'REQUESTED': 'nieuw',           // Return request awaiting merchant approval
    'OPEN': 'onderweg',             // Approved, customer can ship back (with label)
    'INSPECTION': 'ontvangen_controle', // Received, being inspected
    'CLOSED': 'klaar',                  // Completed
    'CANCELLED': 'niet_ontvangen',      // Cancelled/rejected
    'CANCELED': 'niet_ontvangen',       // Alternate spelling
    'DECLINED': 'niet_ontvangen'        // Declined requests
};

/**
 * Map a Shopify return to our local return schema
 */
export async function mapShopifyReturnToLocal(
    shopifyReturn: ShopifyReturn,
    storage: IStorage
): Promise<{ returnData: InsertReturn; items: Omit<InsertReturnItem, 'returnId'>[] }> {
    // Extract order ID from Shopify GID
    const shopifyOrderId = shopifyReturn.order.id.split('/').pop();

    // Look up local order by Shopify ID
    let localOrder = null;
    if (shopifyOrderId) {
        localOrder = await storage.getOrderByShopifyId(shopifyOrderId);

        if (!localOrder) {
            console.log(`⚠️  Order ${shopifyReturn.order.name} (Shopify ID: ${shopifyOrderId}) not found in local database`);
            console.log(`   ℹ️  This return will be created without order/customer link`);
        } else {
            console.log(`✅ Found local order: ${localOrder.orderNumber} (Customer ID: ${localOrder.customerId || 'none'})`);
        }
    }

    // Map status
    console.log(`Mapping status for return ${shopifyReturn.name}: '${shopifyReturn.status}'`);
    const normalizedStatus = shopifyReturn.status.toUpperCase();
    const status = SHOPIFY_STATUS_MAP[normalizedStatus] || 'nieuw_onderweg';

    if (!SHOPIFY_STATUS_MAP[normalizedStatus]) {
        console.warn(`⚠️  Unknown Shopify status '${shopifyReturn.status}', defaulting to 'nieuw_onderweg'`);
    } else {
        console.log(`✅ Mapped '${shopifyReturn.status}' to '${status}'`);
    }

    // Extract customer information from order if available
    let customerId = localOrder?.customerId || null;

    // Build return data
    const returnData: InsertReturn = {
        // Shopify integration fields
        shopifyReturnId: shopifyReturn.id,
        shopifyReturnName: shopifyReturn.name,
        syncedAt: new Date(),

        // Relationships
        orderId: localOrder?.id || null,
        customerId,

        // Status and details
        status: status as any,
        requestedAt: shopifyReturn.orderCreatedAt ? new Date(shopifyReturn.orderCreatedAt) : new Date(),
        completedAt: null,

        // Notes
        customerNotes: null,

        // Refund information
        refundStatus: shopifyReturn.status === 'CLOSED' || shopifyReturn.status === 'COMPLETE' ? 'completed' : 'pending',
    };

    // Extract line items - without product details
    const items: Omit<InsertReturnItem, 'returnId'>[] = [];
    const customerNotes: string[] = [];

    for (const edge of shopifyReturn.returnLineItems.edges) {
        const lineItem = edge.node;
        const productInfo = lineItem.fulfillmentLineItem?.lineItem;

        items.push({
            sku: productInfo?.sku || undefined,
            productName: productInfo ? productInfo.title : `Retour item (${lineItem.quantity}x)`,
            quantity: lineItem.quantity,
            // Convert price to cents (integer) - Shopify gives decimal like "10.95", DB expects 1095
            unitPrice: productInfo?.originalUnitPriceSet ? Math.round(parseFloat(productInfo.originalUnitPriceSet.shopMoney.amount) * 100) : 0,
            restockable: lineItem.refundableQuantity > 0,
        });

        if (lineItem.customerNote) {
            customerNotes.push(`${lineItem.customerNote}`);
        }
        if (lineItem.returnReasonNote) {
            customerNotes.push(`Reden: ${lineItem.returnReasonNote}`);
        }
    }

    if (customerNotes.length > 0) {
        returnData.customerNotes = customerNotes.join('\n');
    }

    return { returnData, items };
}

/**
 * Sync Shopify returns to local database
 * NOTE: Only creates NEW returns, does NOT update existing ones to preserve local changes
 */
export async function syncShopifyReturns(
    storage: IStorage,
    onProgress?: (current: number, total: number, message: string) => void,
    fullSync: boolean = false
) {
    console.log('🔄 Starting Shopify returns synchronization...');

    const lastSyncTime = await storage.getSetting('shopify_returns_last_sync');

    // Always go back 365 days to catch ALL active returns
    // Since we now filter by status (REQUESTED or IN_PROGRESS), this is efficient and safe
    // This ensures we never miss a return even if last_sync is recent
    const sinceDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    console.log(`Fetching active returns (REQUESTED/IN_PROGRESS) since: ${sinceDate.toISOString()}`);

    const shopifyReturns = await shopifyClient.getReturnsSinceDate(sinceDate, (processed) => {
        onProgress?.(processed, 0, `Ophalen return ${processed} van Shopify...`);
    });

    console.log(`📦 Retrieved ${shopifyReturns.length} returns from Shopify`);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < shopifyReturns.length; i++) {
        const shopifyReturn = shopifyReturns[i];

        onProgress?.(i + 1, shopifyReturns.length, `Verwerken return ${i + 1}/${shopifyReturns.length}...`);

        try {
            const existing = await storage.getReturnByShopifyId(shopifyReturn.id);

            if (existing) {
                // Smart sync: Update status from "nieuw" to "onderweg" when Shopify shows OPEN
                // This means the customer has a return label and the package is likely in transit
                const shopifyStatus = shopifyReturn.status.toUpperCase();

                if (existing.status === 'nieuw' && shopifyStatus === 'OPEN') {
                    // Reset timer: always set acceptedAt to NOW when transitioning to onderweg
                    const now = new Date();
                    await storage.updateReturn(existing.id, {
                        status: 'onderweg',
                        acceptedAt: now, // Start of 14-day deadline - always reset on transition
                        shopifyStatus: shopifyStatus,
                        syncedAt: now,
                    });
                    updated++;
                    console.log(`🔄 Updated ${existing.returnNumber}: nieuw → onderweg (Shopify: OPEN), timer reset to 0d`);
                    continue;
                }

                // For all other cases, preserve local changes
                console.log(`⏭️  Skipping ${existing.returnNumber} - local status "${existing.status}" preserved`);
                skipped++;
                continue;
            }

            // Skip CLOSED, CANCELLED, or DECLINED returns (already completed/archived in Shopify)
            // Note: Our query now filters most of these out, but double check here
            if (shopifyReturn.status === 'CLOSED' || shopifyReturn.status === 'CANCELLED' || shopifyReturn.status === 'DECLINED') {
                console.log(`⏭️  Skipping ${shopifyReturn.status} return ${shopifyReturn.name} - not active`);
                skipped++;
                continue;
            }

            // Create new return
            const { returnData, items } = await mapShopifyReturnToLocal(shopifyReturn, storage);
            const newReturn = await storage.createReturnWithItems(returnData, items);
            created++;

            console.log(`✅ Created return ${newReturn.returnNumber} from Shopify ${shopifyReturn.name} with ${items.length} items`);

        } catch (error) {
            console.error(`❌ Error processing return ${shopifyReturn.name}:`, error);
            skipped++;
        }
    }

    await storage.setSetting('shopify_returns_last_sync', new Date().toISOString());

    const summary = {
        total: shopifyReturns.length,
        created,
        updated,
        skipped,
    };

    console.log('✅ Shopify returns sync completed:', summary);

    return summary;
}
