import type { IStorage } from '../storage';
import { shopifyClient } from './shopifyClient';
import { mapShopifyReturnToLocal } from './shopifyReturnsSync';

/**
 * Status mapping from Shopify to Hub
 * 
 * Shopify Webhooks:
 * - RETURNS_REQUEST (REQUESTED) → nieuw
 * - RETURNS_APPROVE (OPEN) → onderweg  
 * - RETURNS_DECLINE (DECLINED) → niet_ontvangen
 * - RETURNS_CLOSE (CLOSED) → klaar
 * - RETURNS_CANCEL (CANCELLED) → niet_ontvangen
 */
export function mapStatusToLocal(shopifyStatus: string): string {
    const statusMap: Record<string, string> = {
        'REQUESTED': 'nieuw',
        'OPEN': 'onderweg',
        'CLOSED': 'klaar',
        'DECLINED': 'niet_ontvangen',
        'CANCELLED': 'niet_ontvangen'
    };
    return statusMap[shopifyStatus.toUpperCase()] || 'nieuw';
}

/**
 * Fetch tracking info for a return by querying its reverse fulfillment orders
 */
async function fetchTrackingInfoForReturn(returnId: string): Promise<{ number?: string; company?: string; url?: string } | null> {
    try {
        const query = `
            query getReturnTracking($id: ID!) {
                return(id: $id) {
                    id
                    reverseFulfillmentOrders(first: 5) {
                        nodes {
                            id
                            reverseDeliveries(first: 1) {
                                nodes {
                                    id
                                    deliverables(first: 1) {
                                        nodes {
                                            ... on ReverseDeliveryShippingDeliverable {
                                                tracking {
                                                    number
                                                    carrierName
                                                    url
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `;

        const data = await shopifyClient.makeGraphQLRequest(query, { id: returnId });

        const rfos = data?.return?.reverseFulfillmentOrders?.nodes || [];
        for (const rfo of rfos) {
            const deliveries = rfo?.reverseDeliveries?.nodes || [];
            for (const delivery of deliveries) {
                const deliverables = delivery?.deliverables?.nodes || [];
                for (const deliverable of deliverables) {
                    if (deliverable?.tracking) {
                        return {
                            number: deliverable.tracking.number,
                            company: deliverable.tracking.carrierName,
                            url: deliverable.tracking.url
                        };
                    }
                }
            }
        }
        return null;
    } catch (error) {
        console.log('ℹ️  Could not fetch tracking info:', error);
        return null;
    }
}

/**
 * Process a Shopify return webhook (RETURNS_REQUEST, RETURNS_APPROVE, RETURNS_DECLINE, RETURNS_CLOSE, RETURNS_CANCEL)
 * Fetches complete return data by ID and syncs to database
 */
export async function processReturnWebhook(
    returnId: string,
    storage: IStorage,
    webhookTopic?: string
): Promise<{ success: boolean; returnNumber?: string; error?: string }> {
    try {
        console.log(`🔄 Processing return webhook: ${returnId} (topic: ${webhookTopic || 'unknown'})`);

        // Step 1: Fetch complete return data using return(id:) query
        const shopifyReturn = await shopifyClient.getReturnById(returnId);

        console.log(`📦 Retrieved return: ${shopifyReturn.name} (${shopifyReturn.status})`);

        // Step 2: Check if return already exists
        const existing = await storage.getReturnByShopifyId(shopifyReturn.id);

        if (existing) {
            // Update existing return with new status and shopify status
            console.log(`♻️  Updating existing return: ${existing.returnNumber} → ${shopifyReturn.status}`);

            const localStatus = mapStatusToLocal(shopifyReturn.status);

            const updateData: any = {
                status: localStatus as any,
                shopifyStatus: shopifyReturn.status,
                syncedAt: new Date(),
            };

            // For RETURNS_APPROVE, also try to fetch tracking info (label is usually created at approval)
            if (webhookTopic === 'returns/approve' || shopifyReturn.status === 'OPEN') {
                try {
                    const trackingInfo = await fetchTrackingInfoForReturn(returnId);
                    if (trackingInfo) {
                        if (trackingInfo.number) updateData.trackingNumber = trackingInfo.number;
                        if (trackingInfo.company) updateData.trackingCarrier = trackingInfo.company;
                        if (trackingInfo.url) updateData.trackingUrl = trackingInfo.url;
                        if (trackingInfo.number && !existing.labelCreatedAt) {
                            updateData.labelCreatedAt = new Date();
                        }
                        console.log(`📦 Tracking info: ${trackingInfo.number} (${trackingInfo.company})`);
                    }
                } catch (e) {
                    console.log(`ℹ️  No tracking info available yet`);
                }
            }

            await storage.updateReturn(existing.id, updateData);

            console.log(`✅ Updated return ${existing.returnNumber} to status: ${localStatus}`);
            return {
                success: true,
                returnNumber: existing.returnNumber
            };
        }

        // Step 3: Map Shopify return to local schema (for new returns)
        const { returnData, items } = await mapShopifyReturnToLocal(shopifyReturn, storage);

        // Add shopifyStatus to the return data
        returnData.shopifyStatus = shopifyReturn.status;

        // Step 4: Create return with items
        const newReturn = await storage.createReturnWithItems(returnData, items);

        console.log(`✅ Created return ${newReturn.returnNumber} from webhook with ${items.length} items`);

        return {
            success: true,
            returnNumber: newReturn.returnNumber
        };

    } catch (error: any) {
        console.error(`❌ Error processing return webhook:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Process a Shopify reverse delivery webhook (REVERSE_DELIVERIES_CREATE, REVERSE_DELIVERIES_UPDATE)
 * Updates return with tracking information from the shipping label
 */
export async function processReverseDeliveryWebhook(
    reverseDeliveryId: string,
    storage: IStorage
): Promise<{ success: boolean; returnNumber?: string; error?: string }> {
    try {
        console.log(`📬 Processing reverse delivery webhook: ${reverseDeliveryId}`);

        // Fetch reverse delivery data with tracking info
        const reverseDelivery = await shopifyClient.getReverseDeliveryById(reverseDeliveryId);

        if (!reverseDelivery) {
            console.log(`⚠️  Reverse delivery not found: ${reverseDeliveryId}`);
            return { success: false, error: 'Reverse delivery not found' };
        }

        console.log(`📦 Retrieved reverse delivery for return: ${reverseDelivery.returnId}`);

        // Find the associated return in our database
        const existing = await storage.getReturnByShopifyId(reverseDelivery.returnId);

        if (!existing) {
            console.log(`⚠️  Return not found for reverse delivery: ${reverseDelivery.returnId}`);
            return { success: false, error: 'Associated return not found' };
        }

        // Update return with tracking information
        const updateData: any = {
            syncedAt: new Date(),
        };

        if (reverseDelivery.trackingInfo) {
            if (reverseDelivery.trackingInfo.number) {
                updateData.trackingNumber = reverseDelivery.trackingInfo.number;
            }
            if (reverseDelivery.trackingInfo.company) {
                updateData.trackingCarrier = reverseDelivery.trackingInfo.company;
            }
            if (reverseDelivery.trackingInfo.url) {
                updateData.trackingUrl = reverseDelivery.trackingInfo.url;
            }
        }

        // Set label created date if first time seeing tracking
        if (!existing.labelCreatedAt && updateData.trackingNumber) {
            updateData.labelCreatedAt = new Date();
        }

        await storage.updateReturn(existing.id, updateData);

        console.log(`✅ Updated return ${existing.returnNumber} with tracking: ${updateData.trackingNumber || 'none'} (${updateData.trackingCarrier || 'unknown carrier'})`);

        return {
            success: true,
            returnNumber: existing.returnNumber
        };

    } catch (error: any) {
        console.error(`❌ Error processing reverse delivery webhook:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}
