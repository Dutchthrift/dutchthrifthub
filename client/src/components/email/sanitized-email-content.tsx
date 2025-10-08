import DOMPurify from 'isomorphic-dompurify';
// @ts-ignore - no types available
import { decode as decodeQuotedPrintable } from 'quoted-printable';
import { decode as decodeBase64 } from 'js-base64';

interface SanitizedEmailContentProps {
  body: string;
  isHtml: boolean;
  encoding?: string;
}

export function SanitizedEmailContent({ body, isHtml, encoding }: SanitizedEmailContentProps) {
  if (!body) {
    return (
      <div className="text-muted-foreground italic">
        No content available
      </div>
    );
  }

  const decodeEmailBody = (rawData: string, transferEncoding?: string): string => {
    let decoded = rawData;

    // Step 1: Base64 decode if needed
    if (transferEncoding === 'base64') {
      try {
        decoded = decodeBase64(decoded);
      } catch (e) {
        console.error('Error decoding base64:', e);
      }
    } else if (!decoded.includes('=') && !decoded.includes('<') && decoded.length > 50) {
      // Auto-detect base64 content
      const base64Pattern = /^[A-Za-z0-9+/=\s]+$/;
      if (base64Pattern.test(decoded.replace(/\s/g, ''))) {
        try {
          const cleanBase64 = decoded.replace(/\s/g, '');
          decoded = decodeBase64(cleanBase64);
        } catch (e) {
          // Not base64, continue
        }
      }
    }

    // Step 2: Quoted-printable decode if detected
    // Look for patterns like =0A, =C2, =3D, or soft line breaks (=\r\n)
    if (decoded.includes('=0A') || decoded.includes('=C2') || decoded.includes('=3D') || 
        decoded.includes('=20') || decoded.includes('=E2') || /=\r?\n/.test(decoded)) {
      try {
        decoded = decodeQuotedPrintable(decoded);
      } catch (e) {
        console.error('Error decoding quoted-printable:', e);
      }
    }

    // Step 3: Ensure UTF-8 decoding
    try {
      if (typeof TextDecoder !== 'undefined' && decoded.includes('\ufffd')) {
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(decoded);
        const decoder = new TextDecoder('utf-8');
        decoded = decoder.decode(uint8Array);
      }
    } catch (e) {
      // UTF-8 decoding not needed or failed
    }

    // Step 4: Clean MIME headers at the beginning
    const lines = decoded.split('\n');
    let contentStartIndex = 0;
    
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const line = lines[i].trim();
      if (line.match(/^[A-Za-z-]+:\s*.+/) || line.startsWith('--') || line === '') {
        contentStartIndex = i + 1;
      } else {
        break;
      }
    }

    if (contentStartIndex > 0 && contentStartIndex < lines.length) {
      decoded = lines.slice(contentStartIndex).join('\n');
    }

    // Step 5: Remove common MIME artifacts
    decoded = decoded.replace(/Content-Type:[^\n]*\n?/gi, '');
    decoded = decoded.replace(/Content-Transfer-Encoding:[^\n]*\n?/gi, '');
    decoded = decoded.replace(/Content-Disposition:[^\n]*\n?/gi, '');
    decoded = decoded.replace(/Mime-Version:[^\n]*\n?/gi, '');
    decoded = decoded.replace(/charset="?[^"\n]*"?\n?/gi, '');
    decoded = decoded.replace(/--[a-zA-Z0-9_-]{10,}[^\n]*\n?/g, '');

    return decoded.trim();
  };

  // Decode the email body with encoding hint
  const decodedBody = decodeEmailBody(body, encoding);

  // Check if this is HTML content
  const isActuallyHtml = isHtml || 
    decodedBody.includes('<!DOCTYPE') || 
    decodedBody.includes('<html') || 
    decodedBody.includes('<body') ||
    decodedBody.includes('<div') || 
    decodedBody.includes('<p>') ||
    decodedBody.includes('<table');

  // Render plain text emails
  if (!isActuallyHtml) {
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground break-words">
        {decodedBody}
      </div>
    );
  }

  // Sanitize and render HTML emails
  const sanitizeHtml = (html: string): string => {
    const config = {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'a', 'img', 'div', 'span', 'table', 'thead', 'tbody',
        'tr', 'td', 'th', 'blockquote', 'code', 'pre', 'hr', 'b', 'i', 'font'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'width', 'height'],
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target', 'rel'],
      FORCE_BODY: true,
    };

    let cleanHtml = html;

    // Remove style tags (but keep the content structure)
    cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Remove inline styles but keep the tags
    cleanHtml = cleanHtml.replace(/\s*style="[^"]*"/gi, '');
    
    // Remove classes
    cleanHtml = cleanHtml.replace(/\s*class="[^"]*"/gi, '');
    
    // Clean up excessive whitespace
    cleanHtml = cleanHtml.replace(/&nbsp;/g, ' ');

    const sanitized = DOMPurify.sanitize(cleanHtml, config);
    return sanitized;
  };

  const sanitized = sanitizeHtml(decodedBody);

  if (!sanitized || sanitized.trim().length === 0) {
    return (
      <div className="text-muted-foreground italic text-sm">
        Email content could not be displayed
      </div>
    );
  }

  return (
    <div className="overflow-x-auto max-w-full">
      <style>{`
        .email-content-wrapper table {
          max-width: 100% !important;
          width: auto !important;
          table-layout: auto !important;
        }
        .email-content-wrapper td,
        .email-content-wrapper th {
          max-width: 300px !important;
          word-wrap: break-word !important;
          word-break: break-word !important;
          overflow-wrap: anywhere !important;
        }
        .email-content-wrapper * {
          max-width: 100% !important;
        }
      `}</style>
      <div 
        className="email-content-wrapper prose prose-sm max-w-none dark:prose-invert
          prose-p:my-2 prose-p:leading-relaxed
          prose-headings:mt-4 prose-headings:mb-2 prose-headings:font-semibold
          prose-ul:my-2 prose-ol:my-2 prose-ul:pl-4 prose-ol:pl-4
          prose-li:my-1
          prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline prose-a:break-words
          prose-img:rounded-md prose-img:shadow-sm prose-img:max-w-full prose-img:h-auto
          prose-blockquote:border-l-4 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-600 prose-blockquote:pl-4 prose-blockquote:italic
          prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:break-words prose-code:text-sm
          prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:p-3 prose-pre:rounded-md prose-pre:overflow-x-auto
          prose-hr:my-4 prose-hr:border-gray-300 dark:prose-hr:border-gray-600
          prose-table:border-collapse prose-table:max-w-full prose-table:my-4 prose-table:table-auto
          prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-600 prose-td:px-2 prose-td:py-1 prose-td:text-xs
          prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-600 prose-th:px-2 prose-th:py-1 prose-th:bg-gray-100 dark:prose-th:bg-gray-800 prose-th:text-xs
          text-foreground
          break-words overflow-wrap-anywhere
        "
        style={{ 
          wordBreak: 'break-word', 
          overflowWrap: 'anywhere',
          maxWidth: '100%' 
        }}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    </div>
  );
}
