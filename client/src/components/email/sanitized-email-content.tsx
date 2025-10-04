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

  if (!isHtml) {
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed">
        {body}
      </div>
    );
  }

  const sanitizeHtml = (html: string): string => {
    const config = {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'a', 'img', 'div', 'span', 'table', 'thead', 'tbody',
        'tr', 'td', 'th', 'blockquote', 'code', 'pre', 'hr'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'],
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target'],
      FORCE_BODY: true,
    };

    let cleanHtml = html;

    cleanHtml = cleanHtml.replace(/Content-Type:[^\n]*/gi, '');
    cleanHtml = cleanHtml.replace(/Content-Transfer-Encoding:[^\n]*/gi, '');
    cleanHtml = cleanHtml.replace(/--[a-zA-Z0-9_-]{10,}[^\n]*/g, '');
    cleanHtml = cleanHtml.replace(/boundary="[^"]*"/gi, '');
    
    cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    cleanHtml = cleanHtml.replace(/style="[^"]*"/gi, '');
    cleanHtml = cleanHtml.replace(/class="[^"]*"/gi, '');
    
    cleanHtml = cleanHtml.replace(/&nbsp;/g, ' ');
    cleanHtml = cleanHtml.replace(/\s{2,}/g, ' ');

    const sanitized = DOMPurify.sanitize(cleanHtml, config);

    if (!sanitized || sanitized.trim().length === 0) {
      return html;
    }

    return sanitized;
  };

  const sanitizedHtml = sanitizeHtml(body);

  const hasHtmlTags = /<[^>]+>/.test(sanitizedHtml);
  
  if (!hasHtmlTags) {
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed">
        {sanitizedHtml}
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
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
