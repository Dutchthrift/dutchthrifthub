import type { IStorage } from '../storage';
import { shopifyClient } from './shopifyClient';
import { mapShopifyReturnToLocal } from './shopifyReturnsSync';

/**
 * Process a Shopify return webhook
 * Fetches complete return data by ID and syncs to database
 */
export async function processReturnWebhook(
    returnId: string,
    storage: IStorage
): Promise<{ success: boolean; returnNumber?: string; error?: string }> {
    try {
        console.log(`🔄 Processing return webhook: ${returnId}`);

        // Step 1: Fetch complete return data using return(id:) query
        const shopifyReturn = await shopifyClient.getReturnById(returnId);

        console.log(`📦 Retrieved return: ${shopifyReturn.name} (${shopifyReturn.status})`);

        // Step 2: Check if return already exists
        const existing = await storage.getReturnByShopifyId(shopifyReturn.id);

        if (existing) {
            // Update existing return
            console.log(`♻️  Updating existing return: ${existing.returnNumber}`);

            // For now, just update the status and syncedAt
            // In the future, could update all fields
            await storage.updateReturn(existing.id, {
                status: mapStatusToLocal(shopifyReturn.status),
                syncedAt: new Date(),
            });

            console.log(`✅ Updated return ${existing.returnNumber}`);
            return {
                success: true,
                returnNumber: existing.returnNumber
            };
        }

        // Step 3: Map Shopify return to local schema
        const { returnData, items } = await mapShopifyReturnToLocal(shopifyReturn, storage);

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

// Helper function to map Shopify status to local status
function mapStatusToLocal(shopifyStatus: string): any {
    const statusMap: Record<string, string> = {
        'REQUESTED': 'nieuw_onderweg',
        'OPEN': 'ontvangen_controle',
        'CLOSED': 'klaar',
        'CANCELLED': 'niet_ontvangen'
    };
    return statusMap[shopifyStatus] || 'nieuw_onderweg';
}
