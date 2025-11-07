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

    // Step 1: Remove multipart boundaries and MIME headers first
    // This prevents them from interfering with decoding
    const lines = decoded.split('\n');
    const cleanedLines: string[] = [];
    let skipUntilEmpty = false;
    let inMimeHeaders = true;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip multipart boundaries
      if (trimmedLine.startsWith('--') && trimmedLine.length > 10) {
        skipUntilEmpty = true;
        continue;
      }
      
      // Skip MIME headers at the beginning
      if (inMimeHeaders) {
        if (trimmedLine === '') {
          inMimeHeaders = false;
          continue;
        }
        if (trimmedLine.match(/^[A-Za-z-]+:\s*.+/)) {
          continue;
        }
        inMimeHeaders = false;
      }
      
      // Skip lines after boundary until we hit content
      if (skipUntilEmpty) {
        if (trimmedLine === '' || trimmedLine.match(/^[A-Za-z-]+:\s*.+/)) {
          continue;
        }
        skipUntilEmpty = false;
      }
      
      // Skip standalone MIME headers anywhere in content
      if (trimmedLine.match(/^(Content-Type|Content-Transfer-Encoding|Content-Disposition|Mime-Version|charset):/i)) {
        continue;
      }
      
      cleanedLines.push(line);
    }
    
    decoded = cleanedLines.join('\n').trim();

    // Step 2: Base64 decode if needed
    if (transferEncoding?.toLowerCase() === 'base64' || 
        (!decoded.includes('<') && !decoded.includes('=') && decoded.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(decoded.substring(0, 200)))) {
      try {
        const cleanBase64 = decoded.replace(/\s/g, '');
        if (cleanBase64.length > 0) {
          decoded = decodeBase64(cleanBase64);
        }
      } catch (e) {
        console.error('Error decoding base64:', e);
      }
    }

    // Step 3: Quoted-printable decode if detected
    if (transferEncoding?.toLowerCase() === 'quoted-printable' ||
        decoded.includes('=0A') || decoded.includes('=3D') || /=[0-9A-F]{2}/.test(decoded)) {
      try {
        decoded = decodeQuotedPrintable(decoded);
      } catch (e) {
        console.error('Error decoding quoted-printable:', e);
      }
    }

    // Step 4: Remove any remaining MIME artifacts
    decoded = decoded.replace(/--[a-zA-Z0-9_-]{10,}(--)?[\r\n]*/g, '');
    decoded = decoded.replace(/^(Content-Type|Content-Transfer-Encoding|Content-Disposition|Mime-Version):[^\n]*\n?/gim, '');
    decoded = decoded.replace(/charset="?[^"\n]*"?/gi, '');
    
    // Step 5: Clean up excessive whitespace
    decoded = decoded.replace(/\n{3,}/g, '\n\n');
    decoded = decoded.trim();

    return decoded;
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
        'tr', 'td', 'th', 'blockquote', 'code', 'pre', 'hr', 'b', 'i', 'font',
        'center', 'small', 'big', 'sub', 'sup', 'strike', 's', 'del'
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'target', 'rel', 'width', 'height',
        'align', 'valign', 'bgcolor', 'color', 'size', 'face', 'border',
        'cellpadding', 'cellspacing', 'style'
      ],
      ALLOWED_STYLES: {
        '*': {
          'color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/, /^rgba\(/],
          'background-color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/, /^rgba\(/],
          'font-size': [/^\d+px$/, /^\d+em$/, /^\d+%$/],
          'font-family': [/.*/],
          'font-weight': [/^(normal|bold|\d{3})$/],
          'text-align': [/^(left|right|center|justify)$/],
          'padding': [/^\d+px$/],
          'margin': [/^\d+px$/],
          'border': [/.*/],
          'text-decoration': [/^(none|underline|line-through)$/]
        }
      },
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target'],
      FORCE_BODY: true,
    };

    let cleanHtml = html;

    // Remove style tags but keep inline styles for basic formatting
    cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Remove script tags
    cleanHtml = cleanHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    
    // Convert common entities
    cleanHtml = cleanHtml.replace(/&nbsp;/g, ' ');
    
    // Ensure all links open in new tab
    cleanHtml = cleanHtml.replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');

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
