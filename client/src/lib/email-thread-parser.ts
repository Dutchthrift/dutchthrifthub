/**
 * Parse an email body to extract quoted reply sections and split them into separate "virtual" messages.
 * This allows displaying a single email with embedded quotes as a Gmail-style threaded conversation.
 */

interface ParsedMessage {
    id: string;
    fromEmail: string;
    toEmail: string;
    body: string;
    isHtml: boolean;
    sentAt?: string;
    isQuoted: boolean;
    originalIndex: number;
}

// Patterns to detect quoted email sections
const QUOTE_PATTERNS = {
    // "On [date], [name] <email> wrote:"
    onWrote: /On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^<>]*<([^>]+)>\s*wrote:/gi,
    // "Van: Name <email>" (Dutch)
    vanEmail: /Van:\s*([^<\n]+)<([^>]+)>/gi,
    // "From: Name <email>"
    fromEmail: /From:\s*([^<\n]+)<([^>]+)>/gi,
    // Gmail mobile format: "On Mon, Dec 9, 2025, 15:51 email@example.com <email@example.com> wrote:"
    gmailMobile: /On\s+\w+,\s+\w+\s+\d+,\s+\d+,?\s+[\d:]+\s+([^\s<]+)\s*(?:<[^>]+>)?\s*wrote:/gi,
    // Outlook format: "Van: Name Verzonden: ..."
    outlookVan: /Van:\s*([^\n]+)\nVerzonden:\s*([^\n]+)/gi,
    // Generic "wrote:" pattern
    genericWrote: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s*wrote:/gi,
};

// HTML quote markers
const HTML_QUOTE_PATTERNS = [
    /<blockquote[^>]*>/gi,
    /<div\s+class="[^"]*gmail_quote[^"]*"/gi,
    /<div\s+class="[^"]*moz-cite-prefix[^"]*"/gi,
];

/**
 * Extract email address from various formats
 */
function extractEmail(text: string): string | null {
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    return emailMatch ? emailMatch[1] : null;
}

/**
 * Extract date from quote header
 */
function extractDate(text: string): string | null {
    // Try various date formats
    const patterns = [
        /(\d{1,2}\s+\w+\s+\d{4})/,  // "9 december 2025"
        /(\w+\s+\d{1,2},?\s+\d{4})/,  // "Dec 9, 2025"
        /(\d{4}-\d{2}-\d{2})/,  // "2025-12-09"
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            try {
                const date = new Date(match[1]);
                if (!isNaN(date.getTime())) {
                    return date.toISOString();
                }
            } catch {
                // Continue to next pattern
            }
        }
    }
    return null;
}

/**
 * Split plain text email body into quoted sections
 */
function splitPlainTextQuotes(body: string, originalEmail: string): ParsedMessage[] {
    const messages: ParsedMessage[] = [];
    let remainingBody = body;
    let messageIndex = 0;

    // Find all quote start positions
    const quoteStarts: { index: number; email: string; header: string; date?: string }[] = [];

    // Check for "On ... wrote:" pattern (English)
    let match;
    const onWroteRegex = /On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^<\n]*(?:<([^>]+)>)?\s*wrote:/gi;
    while ((match = onWroteRegex.exec(body)) !== null) {
        const email = match[1] || extractEmail(match[0]);
        if (email) {
            quoteStarts.push({
                index: match.index,
                email,
                header: match[0],
                date: extractDate(match[0])
            });
        }
    }

    // Check for French "Le [jour] [date] à [time], [email] a écrit :" pattern
    const frenchRegex = /Le\s+\w+\.?\s+\d+\s+\w+\.?\s+\d{4}\s+à\s+[\d:]+,?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s*(?:<[^>]+>)?\s*a\s+écrit\s*:/gi;
    while ((match = frenchRegex.exec(body)) !== null) {
        const email = match[1] || extractEmail(match[0]);
        if (email) {
            quoteStarts.push({
                index: match.index,
                email,
                header: match[0],
                date: extractDate(match[0])
            });
        }
    }

    // Check for "Van: ... Verzonden: ..." pattern (Outlook Dutch)
    const vanRegex = /Van:\s*([^\n<]+)(?:<([^>]+)>)?\s*\nVerzonden:\s*([^\n]+)/gi;
    while ((match = vanRegex.exec(body)) !== null) {
        const email = match[2] || extractEmail(match[1]);
        if (email) {
            quoteStarts.push({
                index: match.index,
                email,
                header: match[0],
                date: extractDate(match[3])
            });
        }
    }

    // Check for simpler "Van: Name <email>" pattern without Verzonden
    const simpleVanRegex = /Van:\s*[^\n<]*<([^>]+)>/gi;
    while ((match = simpleVanRegex.exec(body)) !== null) {
        // Check if this wasn't already captured by the full Outlook pattern
        const alreadyCaptured = quoteStarts.some(q => Math.abs(q.index - match!.index) < 10);
        if (!alreadyCaptured) {
            quoteStarts.push({
                index: match.index,
                email: match[1],
                header: match[0],
                date: undefined
            });
        }
    }

    // Sort by position in text
    quoteStarts.sort((a, b) => a.index - b.index);

    if (quoteStarts.length === 0) {
        // No quotes found, return single message
        return [{
            id: `msg-0`,
            fromEmail: originalEmail,
            toEmail: 'contact@dutchthrift.com',
            body: body,
            isHtml: false,
            isQuoted: false,
            originalIndex: 0
        }];
    }

    // First part is the main reply (newest message)
    const firstQuoteStart = quoteStarts[0].index;
    const mainReply = body.substring(0, firstQuoteStart).trim();

    if (mainReply) {
        messages.push({
            id: `msg-${messageIndex++}`,
            fromEmail: originalEmail,
            toEmail: 'contact@dutchthrift.com',
            body: mainReply,
            isHtml: false,
            isQuoted: false,
            originalIndex: messageIndex - 1
        });
    }

    // Process each quoted section
    for (let i = 0; i < quoteStarts.length; i++) {
        const current = quoteStarts[i];
        const next = quoteStarts[i + 1];

        // Get the content between this quote header and the next (or end)
        const startAfterHeader = current.index + current.header.length;
        const endIndex = next ? next.index : body.length;
        const quotedContent = body.substring(startAfterHeader, endIndex).trim();

        if (quotedContent) {
            messages.push({
                id: `msg-${messageIndex++}`,
                fromEmail: current.email,
                toEmail: 'contact@dutchthrift.com',
                body: quotedContent,
                isHtml: false,
                sentAt: current.date || undefined,
                isQuoted: true,
                originalIndex: messageIndex - 1
            });
        }
    }

    return messages;
}

/**
 * Split HTML email body into quoted sections
 */
function splitHtmlQuotes(body: string, originalEmail: string): ParsedMessage[] {
    // Strip all HTML tags and parse as plain text
    // This way we can use all our quote detection patterns
    const textContent = body
        .replace(/<br\s*\/?>/gi, '\n')  // Convert <br> to newlines
        .replace(/<\/p>/gi, '\n\n')     // Convert </p> to double newlines
        .replace(/<\/div>/gi, '\n')     // Convert </div> to newlines
        .replace(/<[^>]*>/g, '')        // Strip remaining HTML tags
        .replace(/&nbsp;/gi, ' ')       // Convert &nbsp; to spaces
        .replace(/&lt;/gi, '<')         // Decode HTML entities
        .replace(/&gt;/gi, '>')
        .replace(/&amp;/gi, '&')
        .replace(/\s+/g, ' ')           // Normalize whitespace
        .replace(/\n\s+/g, '\n')        // Clean up leading spaces after newlines
        .trim();

    const messages = splitPlainTextQuotes(textContent, originalEmail);

    // Mark all messages as not HTML since we stripped tags
    return messages.map(msg => ({
        ...msg,
        isHtml: false
    }));
}

/**
 * Main function to parse email body and extract quoted messages
 */
export function parseEmailThread(
    body: string,
    isHtml: boolean,
    originalEmail: string
): ParsedMessage[] {
    if (!body || body.trim().length === 0) {
        return [{
            id: 'msg-0',
            fromEmail: originalEmail,
            toEmail: 'contact@dutchthrift.com',
            body: '(Geen inhoud)',
            isHtml: false,
            isQuoted: false,
            originalIndex: 0
        }];
    }

    const messages = isHtml
        ? splitHtmlQuotes(body, originalEmail)
        : splitPlainTextQuotes(body, originalEmail);

    // Return in chronological order (oldest first)
    return messages.reverse();
}
