import DOMPurify from 'isomorphic-dompurify';

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

  const cleanMimeHeaders = (str: string): string => {
    let cleaned = str;
    
    // Remove all MIME headers and boundaries
    cleaned = cleaned.replace(/Content-Type:[^\n]*\n?/gi, '');
    cleaned = cleaned.replace(/Content-Transfer-Encoding:[^\n]*\n?/gi, '');
    cleaned = cleaned.replace(/Content-Disposition:[^\n]*\n?/gi, '');
    cleaned = cleaned.replace(/Content-ID:[^\n]*\n?/gi, '');
    cleaned = cleaned.replace(/MIME-Version:[^\n]*\n?/gi, '');
    cleaned = cleaned.replace(/--[a-zA-Z0-9_-]{10,}[^\n]*\n?/g, '');
    cleaned = cleaned.replace(/boundary="[^"]*"/gi, '');
    cleaned = cleaned.replace(/charset="[^"]*"/gi, '');
    
    // Remove multipart declarations
    cleaned = cleaned.replace(/This is a multi-part message in MIME format[^\n]*\n?/gi, '');
    cleaned = cleaned.replace(/multipart\/[a-z]+;[^\n]*\n?/gi, '');
    
    return cleaned.trim();
  };

  const decodeBase64 = (str: string): { decoded: string; wasBase64: boolean } => {
    if (!str) {
      return { decoded: str, wasBase64: false };
    }
    
    let workingStr = str;
    
    // Step 1: Clean MIME headers first
    workingStr = cleanMimeHeaders(workingStr);
    
    // Step 2: If there's a clear MIME header block at the start, skip only that block
    // Look for the pattern of headers followed by blank line (but don't split the whole content)
    const headerEndMatch = workingStr.match(/^(.*?\n)\n([\s\S]*)$/);
    if (headerEndMatch && /^[A-Za-z-]+:\s*.+/m.test(headerEndMatch[1])) {
      // Only skip the first header block, keep rest of content intact
      const firstLineAfterHeaders = headerEndMatch[2];
      if (firstLineAfterHeaders && firstLineAfterHeaders.trim().length > 0) {
        workingStr = firstLineAfterHeaders;
      }
    }
    
    // Step 3: Clean whitespace for base64 check
    const cleanedStr = workingStr.replace(/\s+/g, '');
    
    // Step 4: Check if it looks like base64 and is long enough
    const base64Pattern = /^[A-Za-z0-9+/=]+$/;
    if (cleanedStr.length < 10 || !base64Pattern.test(cleanedStr)) {
      return { decoded: workingStr, wasBase64: false };
    }
    
    // Step 5: Try to decode
    try {
      const decoded = atob(cleanedStr);
      
      // Step 6: Validate decoded content is printable
      const isPrintable = decoded.split('').every(char => {
        const code = char.charCodeAt(0);
        return code >= 32 || code === 9 || code === 10 || code === 13;
      });
      
      if (isPrintable) {
        return { decoded, wasBase64: true };
      }
      
      return { decoded: workingStr, wasBase64: false };
    } catch (e) {
      return { decoded: workingStr, wasBase64: false };
    }
  };

  const { decoded: decodedBody } = decodeBase64(body);

  if (!isHtml && !decodedBody.includes('<html') && !decodedBody.includes('<div')) {
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {decodedBody}
      </div>
    );
  }

  const actuallyHtml = isHtml || decodedBody.includes('<html') || decodedBody.includes('<div') || decodedBody.includes('<p>');

  if (!actuallyHtml) {
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {decodedBody}
      </div>
    );
  }

  const sanitizeHtml = (html: string): { sanitized: string; isEmpty: boolean } => {
    const config = {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'a', 'img', 'div', 'span', 'table', 'thead', 'tbody',
        'tr', 'td', 'th', 'blockquote', 'code', 'pre', 'hr', 'b', 'i'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel'],
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target', 'rel'],
      FORCE_BODY: true,
    };

    let cleanHtml = html;

    // Additional MIME cleanup for HTML content
    cleanHtml = cleanMimeHeaders(cleanHtml);
    
    // Remove style tags and inline styles
    cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    cleanHtml = cleanHtml.replace(/style="[^"]*"/gi, '');
    cleanHtml = cleanHtml.replace(/class="[^"]*"/gi, '');
    cleanHtml = cleanHtml.replace(/id="[^"]*"/gi, '');
    
    // Clean up excessive whitespace
    cleanHtml = cleanHtml.replace(/&nbsp;/g, ' ');
    cleanHtml = cleanHtml.replace(/\s{2,}/g, ' ');

    const sanitized = DOMPurify.sanitize(cleanHtml, config);
    const isEmpty = !sanitized || sanitized.trim().length === 0;

    return { sanitized, isEmpty };
  };

  const { sanitized, isEmpty } = sanitizeHtml(decodedBody);

  if (isEmpty) {
    return (
      <div className="text-muted-foreground italic text-sm">
        Email content could not be displayed safely
      </div>
    );
  }

  const hasHtmlTags = /<[^>]+>/.test(sanitized);
  
  if (!hasHtmlTags) {
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {sanitized}
      </div>
    );
  }

  return (
    <div 
      className="prose prose-sm max-w-none dark:prose-invert
        prose-p:my-2 prose-p:leading-relaxed
        prose-headings:mt-4 prose-headings:mb-2
        prose-ul:my-2 prose-ol:my-2
        prose-li:my-1
        prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
        prose-img:rounded-md prose-img:shadow-sm
        prose-blockquote:border-l-4 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-600 prose-blockquote:pl-4 prose-blockquote:italic
        prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
        prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:p-3 prose-pre:rounded-md
        prose-hr:my-4 prose-hr:border-gray-300 dark:prose-hr:border-gray-600
        text-foreground
      "
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
