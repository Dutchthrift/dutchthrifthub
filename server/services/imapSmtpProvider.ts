import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import * as mimeTypes from 'mime-types';
import type { EmailProvider, RawEmail } from './emailProvider';
import { ObjectStorageService } from '../objectStorage';
import { storage } from '../storage';

export class ImapSmtpProvider implements EmailProvider {
  private imapConfig = {
    host: (process.env.IMAP_HOST || '').trim(),
    port: parseInt(process.env.IMAP_PORT || '993'),
    secure: true,
    auth: {
      user: (process.env.IMAP_USER || '').trim(),
      pass: (process.env.IMAP_PASS || '').trim()
    }
  };

  private smtpTransporter = nodemailer.createTransport({
    host: (process.env.SMTP_HOST || '').trim(),
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: {
      user: (process.env.SMTP_USER || '').trim(),
      pass: (process.env.SMTP_PASS || '').trim()
    }
  });

  async syncEmails(): Promise<RawEmail[]> {
    console.log('IMAP Config:', {
      host: this.imapConfig.host,
      port: this.imapConfig.port,
      user: this.imapConfig.auth.user
    });

    const client = new ImapFlow(this.imapConfig);

    // Add error handler to prevent crashes
    client.on('error', (err) => {
      console.error('IMAP client error:', err);
    });

    try {
      console.log('Attempting IMAP connection...');
      await client.connect();

      // Select INBOX
      let lock = await client.getMailboxLock('INBOX');

      try {
        // Get total message count from selected mailbox
        const totalMessages = client.mailbox && typeof client.mailbox === 'object' ? client.mailbox.exists : 10;

        // Calculate range for last 100 messages
        const startSeq = Math.max(1, totalMessages - 99); // Get last 100 messages
        const endSeq = totalMessages;

        console.log(`IMAP total messages: ${totalMessages}, fetching range: ${startSeq}:${endSeq}`);

        // Get recent emails (last 10)
        const messages = [];
        let attachmentQueue: Array<{
          messageIndex: number;
          uid: number;
          seq: number;
          partId: string;
          filename: string;
          contentType: string;
          contentId?: string;
          isInline: boolean;
          size: number;
        }> = [];
        for await (let message of client.fetch(`${startSeq}:${endSeq}`, {
          envelope: true,
          flags: true,
          bodyStructure: true,
          internalDate: true,
          uid: true
        })) {

          // Check if message has attachments
          const hasAttachment = this.checkForAttachments(message.bodyStructure);

          // Build conversation ID from subject and participants
          const envelope = message.envelope;
          const conversationId = envelope ? this.buildConversationId(
            envelope.subject || '',
            envelope.from?.[0]?.address || '',
            envelope.to?.[0]?.address || ''
          ) : `${message.uid}@${this.imapConfig.host}`;

          // Extract actual email body content by walking bodyStructure
          let bodyText = '';
          let isHtml = false;

          try {
            // Find text parts in the body structure
            const textParts = this.findTextParts(message.bodyStructure);
            console.log(`Found ${textParts.length} text parts for UID ${message.uid}`);

            // Prefer HTML, fallback to plain text
            let htmlPart = textParts.find(p => p.type === 'text/html');
            let plainPart = textParts.find(p => p.type === 'text/plain');

            const partToUse = htmlPart || plainPart;

            if (partToUse) {
              console.log(`Downloading ${partToUse.type} part ${partToUse.partId} for UID ${message.uid}`);

              // Add timeout to prevent hanging on large emails
              const downloadWithTimeout = async () => {
                const timeoutMs = 30000; // 30 second timeout
                const timeoutPromise = new Promise<never>((_, reject) => {
                  setTimeout(() => reject(new Error(`Download timeout after ${timeoutMs}ms`)), timeoutMs);
                });

                const downloadPromise = async () => {
                  const { content: stream } = await client.download(message.uid, partToUse.partId);
                  const chunks: Buffer[] = [];
                  for await (const chunk of stream) {
                    chunks.push(chunk);
                  }
                  return Buffer.concat(chunks);
                };

                return Promise.race([downloadPromise(), timeoutPromise]);
              };

              const contentBuffer = await downloadWithTimeout();

              // Decode based on encoding
              bodyText = this.decodeContent(contentBuffer, partToUse.encoding);
              isHtml = partToUse.type === 'text/html';

              console.log(`Successfully extracted body (${partToUse.type}), length: ${bodyText.length}`);
            }
          } catch (error) {
            console.error('Error extracting body from message:', error);
          }

          // Final fallback if no body extracted
          if (!bodyText || bodyText.trim().length === 0) {
            const subject = envelope?.subject || 'No subject';
            const fromAddr = envelope?.from?.[0]?.address || 'unknown';
            bodyText = `[Content not available] Message from ${fromAddr} with subject: "${subject}"`;
            console.log('Using fallback placeholder for message:', message.uid);
          }

          const rawEmail: RawEmail = {
            messageId: envelope?.messageId || `${message.uid}@${this.imapConfig.host}`,
            uid: message.uid,
            conversationId,
            subject: envelope?.subject || '',
            from: envelope?.from?.[0]?.address || '',
            to: envelope?.to?.[0]?.address || '',
            body: bodyText,
            isHtml: isHtml,
            receivedDateTime: message.internalDate instanceof Date ? message.internalDate.toISOString() : new Date().toISOString(),
            isRead: message.flags?.has('\\Seen') || false,
            hasAttachment,
            inReplyTo: envelope?.inReplyTo,
            references: ''
          };

          // Collect attachment descriptors if email has them
          if (hasAttachment) {
            console.log(`📎 Collecting attachment descriptors for Message UID ${message.uid}`);
            const descriptors = this.collectAttachmentDescriptors(message, messages.length, message.seq);
            rawEmail.attachments = descriptors;
            console.log(`📎 Found ${descriptors.length} attachment descriptors`);
          }

          messages.push(rawEmail);
        }

        // Phase 2: Download attachments removed - we now fetch on demand
        console.log(`✅ Sync completed. Processed ${messages.length} messages.`);

        lock.release();
        await client.logout();
        return messages;

      } catch (err) {
        if (lock) lock.release();
        throw err;
      }
    } catch (error) {
      console.error('IMAP sync error:', error);
      return [];
    } finally {
      if (client) {
        client.close();
      }
    }
  }


  async sendEmail(to: string, subject: string, body: string, replyToMessageId?: string): Promise<{ success: boolean }> {
    try {
      const mailOptions: any = {
        from: process.env.SMTP_USER,
        to,
        subject,
        html: body,
        text: body.replace(/<[^>]*>/g, '') // Strip HTML for text version
      };

      // Add reply headers if this is a reply
      if (replyToMessageId) {
        mailOptions.inReplyTo = replyToMessageId;
        mailOptions.references = replyToMessageId;
      }

      await this.smtpTransporter.sendMail(mailOptions);
      return { success: true };

    } catch (error) {
      console.error('SMTP send error:', error);
      throw error;
    }
  }

  private checkForAttachments(bodyStructure: any): boolean {
    if (!bodyStructure) return false;

    // Function to recursively check for attachments
    const hasAttachmentRecursive = (structure: any): boolean => {
      if (!structure) return false;

      // Check if this part itself is an attachment
      if (structure.disposition === 'attachment') {
        return true;
      }

      // Check for images or files with names (inline attachments)
      if (structure.type && structure.type !== 'text' && structure.parameters?.name) {
        return true;
      }

      // Check if this is an image type (common inline attachments)
      if (structure.type === 'image') {
        return true;
      }

      // Recursively check child nodes for multipart messages
      if (structure.childNodes && Array.isArray(structure.childNodes)) {
        return structure.childNodes.some((child: any) => hasAttachmentRecursive(child));
      }

      return false;
    };

    return hasAttachmentRecursive(bodyStructure);
  }

  // Helper function to detect content type from filename using mime-types library
  private detectContentTypeFromFilename(filename: string): string {
    // Use mime-types library for comprehensive MIME type detection
    const detectedType = mimeTypes.lookup(filename);

    if (detectedType) {
      console.log(`🔍 Detected MIME type for ${filename}: ${detectedType}`);
      return detectedType;
    }

    // Fallback to manual detection for any edge cases
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'pdf':
        return 'application/pdf';
      case 'doc':
        return 'application/msword';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'xls':
        return 'application/vnd.ms-excel';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'txt':
        return 'text/plain';
      default:
        console.log(`⚠️ Could not detect MIME type for ${filename}, using application/octet-stream`);
        return 'application/octet-stream';
    }
  }

  // Find text parts (text/plain or text/html) in body structure
  private findTextParts(bodyStructure: any): Array<{ partId: string; type: string; encoding: string }> {
    const textParts: Array<{ partId: string; type: string; encoding: string }> = [];

    const walkParts = (part: any) => {
      if (!part) return;

      // Check if this is a text part
      if (part.type === 'text/plain' || part.type === 'text/html') {
        const partId = part.part || '1';
        const encoding = part.encoding?.toLowerCase() || 'utf-8';
        textParts.push({ partId, type: part.type, encoding });
      }

      // Recursively process child nodes
      if (part.childNodes && Array.isArray(part.childNodes)) {
        for (const childPart of part.childNodes) {
          walkParts(childPart);
        }
      }
    };

    // Start walking from root
    if (bodyStructure.childNodes) {
      for (const childPart of bodyStructure.childNodes) {
        walkParts(childPart);
      }
    } else {
      walkParts(bodyStructure);
    }

    return textParts;
  }

  // Decode content based on encoding
  private decodeContent(content: Buffer, encoding: string): string {
    try {
      let textContent = content.toString('utf-8');

      // Strip MIME headers if present (headers end with double newline)
      const headerEndIndex = textContent.indexOf('\r\n\r\n');
      if (headerEndIndex > -1 && headerEndIndex < 500) { // Headers should be in first 500 chars
        textContent = textContent.substring(headerEndIndex + 4);
      } else {
        const altHeaderEndIndex = textContent.indexOf('\n\n');
        if (altHeaderEndIndex > -1 && altHeaderEndIndex < 500) {
          textContent = textContent.substring(altHeaderEndIndex + 2);
        }
      }

      const encodingLower = encoding.toLowerCase();

      if (encodingLower === 'base64') {
        // Remove whitespace and decode
        const cleanBase64 = textContent.replace(/\s/g, '');
        return Buffer.from(cleanBase64, 'base64').toString('utf-8');
      } else if (encodingLower === 'quoted-printable') {
        // Decode quoted-printable
        let decoded = textContent;
        decoded = decoded.replace(/=\r?\n/g, ''); // Remove soft line breaks
        decoded = decoded.replace(/=([0-9A-F]{2})/gi, (_, hex) =>
          String.fromCharCode(parseInt(hex, 16))
        );
        return decoded;
      } else {
        // 7bit, 8bit, or binary - already converted to string
        return textContent;
      }
    } catch (error) {
      console.error('Error decoding content:', error);
      return content.toString('utf-8');
    }
  }

  // Collect attachment descriptors without downloading (avoids IMAP deadlock)
  private collectAttachmentDescriptors(message: any, messageIndex: number, sequenceNumber: number): Array<{
    messageIndex: number;
    uid: number;
    seq: number;
    partId: string;
    filename: string;
    contentType: string;
    contentId?: string;
    isInline: boolean;
    size: number;
  }> {
    const descriptors: Array<{
      messageIndex: number;
      uid: number;
      seq: number;
      partId: string;
      filename: string;
      contentType: string;
      contentId?: string;
      isInline: boolean;
      size: number;
    }> = [];

    if (!message.bodyStructure) {
      return descriptors;
    }

    const collectFromPart = (part: any) => {
      if (!part) return;

      // Check if this part is an attachment - use broader criteria
      const isAttachment = part.disposition === 'attachment' ||
        part.disposition === 'inline' ||
        (part.type && part.type.startsWith('image/')) ||
        (part.type && !part.type.startsWith('text/'));

      // Use broader filename detection
      const hasFilename = part.parameters?.name || part.dispositionParameters?.filename;

      if (isAttachment && hasFilename) {
        const partId = part.part || '1';
        const filename = part.parameters?.name || part.dispositionParameters?.filename || `part-${partId}`;

        // Use proper content type detection
        const rawContentType = part.type || 'application/octet-stream';
        const contentType = rawContentType === 'application/octet-stream'
          ? this.detectContentTypeFromFilename(filename)
          : rawContentType;

        const contentId = part.id;
        const isInline = part.disposition === 'inline';
        const size = part.size || 0;

        console.log(`📎 Found attachment descriptor: ${filename} (part ${partId}, ${contentType}, ${size} bytes)`);

        descriptors.push({
          messageIndex,
          uid: message.uid,
          seq: sequenceNumber,
          partId,
          filename,
          contentType,
          contentId,
          isInline,
          size
        });
      }

      // Recursively process child nodes
      if (part.childNodes && Array.isArray(part.childNodes)) {
        for (const childPart of part.childNodes) {
          collectFromPart(childPart);
        }
      }
    };

    // Start processing from the root
    const bodyStructure = message.bodyStructure;
    if (bodyStructure.childNodes) {
      for (const childPart of bodyStructure.childNodes) {
        collectFromPart(childPart);
      }
    } else {
      // Single part message
      collectFromPart(bodyStructure);
    }

    return descriptors;
  }

  async fetchEmailBody(uid: number): Promise<{ body: string; isHtml: boolean }> {
    const client = new ImapFlow(this.imapConfig);

    try {
      await client.connect();
      let lock = await client.getMailboxLock('INBOX');

      try {
        const message = await client.fetchOne(uid, {
          bodyStructure: true,
          uid: true
        });

        if (!message) {
          throw new Error(`Message with UID ${uid} not found`);
        }

        // Find text parts
        const textParts = this.findTextParts(message.bodyStructure);
        let htmlPart = textParts.find(p => p.type === 'text/html');
        let plainPart = textParts.find(p => p.type === 'text/plain');
        const partToUse = htmlPart || plainPart;

        if (!partToUse) {
          return { body: '', isHtml: false };
        }

        const { content: stream } = await client.download(uid, partToUse.partId, { uid: true });
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const contentBuffer = Buffer.concat(chunks);

        const body = this.decodeContent(contentBuffer, partToUse.encoding);

        return {
          body,
          isHtml: partToUse.type === 'text/html'
        };

      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  async downloadAttachment(uid: number, partId: string): Promise<{ buffer: Buffer; contentType: string }> {
    const client = new ImapFlow(this.imapConfig);

    try {
      await client.connect();
      let lock = await client.getMailboxLock('INBOX');

      try {
        // Get body structure to determine content type and encoding
        const message = await client.fetchOne(uid, {
          bodyStructure: true,
          uid: true
        });

        if (!message) {
          throw new Error(`Message with UID ${uid} not found`);
        }

        // Find the specific part to get its metadata
        let targetPart: any = null;
        const findPart = (part: any) => {
          if (part.part === partId) {
            targetPart = part;
            return;
          }
          if (part.childNodes) {
            for (const child of part.childNodes) {
              findPart(child);
            }
          }
        };

        if (message.bodyStructure && message.bodyStructure.part === partId) {
          targetPart = message.bodyStructure;
        } else if (message.bodyStructure) {
          findPart(message.bodyStructure);
        }

        const { content: stream } = await client.download(uid, partId, { uid: true });
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        let contentType = 'application/octet-stream';
        if (targetPart) {
          contentType = targetPart.type || 'application/octet-stream';
          // If encoded, we might need to decode? 
          // client.download usually returns raw content. 
          // But for attachments, we usually want the decoded binary.
          // ImapFlow download returns the decoded content if it's base64/quoted-printable?
          // Documentation says: "Downloads a specific part of the message. The content is automatically decoded."
          // So we don't need to manually decode base64 for attachments if using download().
        }

        return { buffer, contentType };

      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  async getLatestUid(): Promise<number> {
    const client = new ImapFlow(this.imapConfig);
    try {
      await client.connect();
      await client.mailboxOpen('INBOX');
      const status = await client.status('INBOX', { uidNext: true });
      return status.uidNext || 0;
    } finally {
      await client.logout();
    }
  }

  async fetchEmails(range: string): Promise<RawEmail[]> {
    const client = new ImapFlow(this.imapConfig);
    try {
      await client.connect();
      let lock = await client.getMailboxLock('INBOX');

      try {
        const messages: RawEmail[] = [];

        // Fetch envelope and flags for the range
        for await (let message of client.fetch(range, {
          envelope: true,
          flags: true,
          internalDate: true,
          uid: true,
          bodyStructure: true
        })) {
          const hasAttachment = this.checkForAttachments(message.bodyStructure);
          const envelope = message.envelope;
          const conversationId = envelope ? this.buildConversationId(
            envelope.subject || '',
            envelope.from?.[0]?.address || '',
            envelope.to?.[0]?.address || ''
          ) : `${message.uid}@${this.imapConfig.host}`;

          messages.push({
            messageId: envelope?.messageId || `${message.uid}@${this.imapConfig.host}`,
            uid: message.uid,
            conversationId,
            subject: envelope?.subject || '',
            from: envelope?.from?.[0]?.address || '',
            to: envelope?.to?.[0]?.address || '',
            body: '', // Body is fetched on-demand
            isHtml: false,
            receivedDateTime: message.internalDate instanceof Date ? message.internalDate.toISOString() : new Date().toISOString(),
            isRead: message.flags?.has('\\Seen') || false,
            hasAttachment,
            inReplyTo: envelope?.inReplyTo,
            references: ''
          });
        }

        // Sort by UID descending (newest first)
        return messages.sort((a, b) => b.uid - a.uid);

      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  private buildConversationId(subject: string, from: string, to: string): string {
    // Remove common reply prefixes and normalize
    const cleanSubject = subject
      .replace(/^(re:|fwd?:|fw:)\s*/i, '')
      .trim()
      .toLowerCase();

    // Create consistent conversation ID
    const participants = [from, to].sort().join('|');
    return `${cleanSubject}|${participants}`.replace(/\s+/g, '_');
  }
}