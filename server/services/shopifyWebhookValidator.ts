import crypto from 'crypto';
import type { Request } from 'express';

/**
 * Validates Shopify webhook HMAC signature
 * @param req Express request object
 * @param secret Shopify webhook secret
 * @returns true if signature is valid
 */
export function validateShopifyWebhook(req: Request, secret: string): boolean {
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256');

    if (!hmacHeader) {
        console.error('❌ Missing X-Shopify-Hmac-Sha256 header');
        return false;
    }

    // Get raw body as string
    const body = JSON.stringify(req.body);

    // Calculate HMAC
    const hash = crypto
        .createHmac('sha256', secret)
        .update(body, 'utf8')
        .digest('base64');

    // Compare signatures (constant-time comparison to prevent timing attacks)
    const isValid = crypto.timingSafeEqual(
        Buffer.from(hmacHeader),
        Buffer.from(hash)
    );

    if (!isValid) {
        console.error('❌ Invalid HMAC signature', {
            expected: hash.substring(0, 10) + '...',
            received: hmacHeader.substring(0, 10) + '...'
        });
    }

    return isValid;
}

/**
 * Extract Shopify topic from webhook headers
 */
export function getWebhookTopic(req: Request): string | undefined {
    return req.get('X-Shopify-Topic');
}

/**
 * Extract Shopify shop domain from webhook headers
 */
export function getWebhookShop(req: Request): string | undefined {
    return req.get('X-Shopify-Shop-Domain');
}
