/**
 * Email content parser utility functions
 * Extracts order numbers, customer info, and other data from email content
 */

/**
 * Extract order number from email content
 * Supports multiple patterns: #12345, Order 12345, Bestelling 12345, etc.
 */
export function extractOrderNumber(content: string): string | null {
    if (!content) return null;

    const patterns = [
        /#(\d{4,})/,                    // #12345
        /order[:\s#]+(\d{4,})/i,        // Order: 12345 or Order #12345
        /bestelling[:\s#]+(\d{4,})/i,   // Bestelling: 12345 (Dutch)
        /ordernummer[:\s#]+(\d{4,})/i,  // Ordernummer: 12345 (Dutch)
        /order\s+number[:\s#]+(\d{4,})/i, // Order number: 12345
    ];

    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

/**
 * Extract customer name from email content
 */
export function extractCustomerName(emailBody: string, fromEmail: string): string | null {
    // Try to extract from email signature
    const namePatterns = [
        /met\s+vriendelijke\s+groet,?\s*\n\s*([A-Z][a-zäöüß]+(?:\s+[A-Z][a-zäöüß]+)+)/i, // Dutch signature
        /best\s+regards,?\s*\n\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i, // English signature
        /mvg,?\s*\n\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i, // Dutch short signature
    ];

    for (const pattern of namePatterns) {
        const match = emailBody.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }

    // Fallback to email username
    const emailUsername = fromEmail.split('@')[0];
    return emailUsername
        .split(/[._-]/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

/**
 * Extract phone number from email content
 */
export function extractPhoneNumber(content: string): string | null {
    const phonePatterns = [
        /(\+31\s?[0-9]{1,2}\s?[0-9]{7,8})/,           // Dutch: +31 6 12345678
        /(\+31\s?\([0-9]{1,2}\)\s?[0-9]{7,8})/,       // Dutch: +31 (6) 12345678
        /(0[0-9]{1,2}[\s-]?[0-9]{7,8})/,              // Dutch: 06-12345678
        /tel[:\s]+(\+?[0-9\s()-]+)/i,                 // Tel: +31...
        /phone[:\s]+(\+?[0-9\s()-]+)/i,               // Phone: +31...
    ];

    for (const pattern of phonePatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }

    return null;
}

/**
 * Extract address from email content
 */
export function extractAddress(content: string): string | null {
    // Look for common address patterns (street + number + postal code)
    const addressPatterns = [
        /([A-Z][a-zäöüß]+(?:\s+[A-Z][a-zäöüß]+)*\s+\d+[a-z]?,?\s+\d{4}\s?[A-Z]{2}\s+[A-Z][a-zäöüß]+)/i, // Dutch address
        /adres[:\s]+(.+?(?:\d{4}\s?[A-Z]{2}))/i, // Adres: ...
    ];

    for (const pattern of addressPatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }

    return null;
}

/**
 * Extract all customer info from email
 */
export function extractCustomerInfo(emailBody: string, fromEmail: string) {
    return {
        name: extractCustomerName(emailBody, fromEmail),
        phone: extractPhoneNumber(emailBody),
        address: extractAddress(emailBody),
    };
}

/**
 * Extract product name/description from email
 */
export function extractProductInfo(content: string): string | null {
    const productPatterns = [
        /product[:\s]+(.+?)(?:\n|$)/i,
        /artikel[:\s]+(.+?)(?:\n|$)/i, // Dutch
        /item[:\s]+(.+?)(?:\n|$)/i,
    ];

    for (const pattern of productPatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }

    return null;
}
