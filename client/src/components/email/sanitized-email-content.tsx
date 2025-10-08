import DOMPurify from 'isomorphic-dompurify';
// @ts-ignore - no types available
import { decode as decodeQuotedPrintable } from 'quoted-printable';
import { decode as decodeBase64 } from 'js-base64';

interface SanitizedEmailContentProps {
  body: string;
  isHtml: boolean;
}

export function SanitizedEmailContent({ body, isHtml }: SanitizedEmailContentProps) {
  if (!body) {
    return (
      <div className="text-muted-foreground italic">
        No content available
      </div>
    );
  }

  const decodeEmailBody = (rawContent: string): string => {
    let decoded = rawContent;

    // Step 1: Check for and decode base64 content
    // Base64 content is typically clean alphanumeric with no special chars
    if (!decoded.includes('=') && !decoded.includes('<') && decoded.length > 50) {
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

    // Step 2: Check for and decode quoted-printable content
    // Quoted-printable has =XX patterns or =\r\n soft line breaks
    if (decoded.includes('=0A') || decoded.includes('=C2') || decoded.includes('=3D') || /=\r?\n/.test(decoded)) {
      try {
        decoded = decodeQuotedPrintable(decoded);
      } catch (e) {
        console.error('Error decoding quoted-printable:', e);
      }
    }

    // Step 3: Clean any remaining MIME headers that might be in the content
    const lines = decoded.split('\n');
    let contentStartIndex = 0;
    
    // Skip MIME headers at the beginning
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const line = lines[i].trim();
      // Check if this looks like a MIME header
      if (line.match(/^[A-Za-z-]+:\s*.+/) || line.startsWith('--') || line === '') {
        contentStartIndex = i + 1;
      } else {
        // We've hit actual content
        break;
      }
    }

    if (contentStartIndex > 0 && contentStartIndex < lines.length) {
      decoded = lines.slice(contentStartIndex).join('\n');
    }

    // Step 4: Remove common MIME artifacts
    decoded = decoded.replace(/Content-Type:[^\n]*\n?/gi, '');
    decoded = decoded.replace(/Content-Transfer-Encoding:[^\n]*\n?/gi, '');
    decoded = decoded.replace(/Content-Disposition:[^\n]*\n?/gi, '');
    decoded = decoded.replace(/Mime-Version:[^\n]*\n?/gi, '');
    decoded = decoded.replace(/charset="?[^"\n]*"?\n?/gi, '');
    decoded = decoded.replace(/--[a-zA-Z0-9_-]{10,}[^\n]*\n?/g, '');

    return decoded.trim();
  };

  // Decode the email body
  const decodedBody = decodeEmailBody(body);

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
    <div 
      className="prose prose-sm max-w-none dark:prose-invert
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
        prose-table:border-collapse prose-table:w-auto prose-table:my-4
        prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-600 prose-td:px-3 prose-td:py-2
        prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-600 prose-th:px-3 prose-th:py-2 prose-th:bg-gray-100 dark:prose-th:bg-gray-800
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
  );
}
