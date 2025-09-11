import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import type { EmailProvider, RawEmail } from './emailProvider';

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
    
    try {
      console.log('Attempting IMAP connection...');
      await client.connect();
      
      // Select INBOX
      let lock = await client.getMailboxLock('INBOX');
      
      try {
        // Get total message count from selected mailbox
        const totalMessages = client.mailbox && typeof client.mailbox === 'object' ? client.mailbox.exists : 50;
        
        // Calculate range for last 50 messages
        const startSeq = Math.max(1, totalMessages - 49); // Get last 50 messages
        const endSeq = totalMessages;
        
        console.log(`IMAP total messages: ${totalMessages}, fetching range: ${startSeq}:${endSeq}`);
        
        // Get recent emails (last 50)
        const messages = [];
        for await (let message of client.fetch(`${startSeq}:${endSeq}`, {
          envelope: true,
          flags: true,
          bodyStructure: true,
          internalDate: true,
          uid: true,
          bodyParts: ['TEXT']
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

          // Extract actual email body content
          let bodyText = '';
          let isHtml = false;
          
          try {
            console.log('Message bodyParts available:', message.bodyParts ? message.bodyParts.size : 0);
            
            // Try to get text/html first, then text/plain
            if (message.bodyParts && message.bodyParts.size > 0) {
              for (let [partId, bodyPart] of Array.from(message.bodyParts.entries())) {
                console.log('Processing bodyPart:', partId, 'length:', bodyPart ? bodyPart.toString().length : 0);
                if (bodyPart) {
                  let content = bodyPart.toString();
                  if (content && content.trim().length > 0) {
                    
                    // Parse multipart MIME content to extract clean text/HTML
                    if (content.includes('Content-Type:') && content.includes('--')) {
                      // This is multipart MIME content, extract the actual message
                      const lines = content.split('\n');
                      let inTextSection = false;
                      let inHtmlSection = false;
                      let cleanContent = '';
                      let currentSection = '';
                      
                      for (const line of lines) {
                        if (line.startsWith('--') && line.length > 10) {
                          // MIME boundary - save current section and reset
                          if (inHtmlSection && currentSection.trim()) {
                            cleanContent = currentSection.trim();
                            isHtml = true;
                            break; // Prefer HTML over plain text
                          } else if (inTextSection && currentSection.trim() && !cleanContent) {
                            cleanContent = currentSection.trim();
                            isHtml = false;
                          }
                          inTextSection = false;
                          inHtmlSection = false;
                          currentSection = '';
                        } else if (line.includes('Content-Type: text/plain')) {
                          inTextSection = true;
                          inHtmlSection = false;
                          currentSection = '';
                        } else if (line.includes('Content-Type: text/html')) {
                          inHtmlSection = true;
                          inTextSection = false;
                          currentSection = '';
                        } else if ((inTextSection || inHtmlSection) && line.trim() !== '' && !line.includes('Content-Type:') && !line.includes('charset=')) {
                          // Actual content line
                          currentSection += line + '\n';
                        }
                      }
                      
                      // Handle final section
                      if (inHtmlSection && currentSection.trim()) {
                        cleanContent = currentSection.trim();
                        isHtml = true;
                      } else if (inTextSection && currentSection.trim() && !cleanContent) {
                        cleanContent = currentSection.trim();
                        isHtml = false;
                      }
                      
                      if (cleanContent) {
                        bodyText = cleanContent;
                        console.log('Extracted clean content, length:', bodyText.length, 'isHtml:', isHtml);
                      } else {
                        // Fallback: use raw content
                        bodyText = content;
                        isHtml = partId.includes('html') || content.includes('<html>') || content.includes('<div>');
                      }
                    } else {
                      // Simple content, use as-is
                      bodyText = content;
                      isHtml = partId.includes('html') || content.includes('<html>') || content.includes('<div>');
                    }
                    
                    console.log('Found body content, length:', bodyText.length, 'isHtml:', isHtml);
                    break;
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error extracting body from message:', error);
          }
          
          // Improved content - try multiple sources and provide better fallbacks
          if (!bodyText || bodyText.trim().length === 0) {
            // Try bodyStructure for simple messages
            if (message.bodyStructure) {
              console.log('Trying bodyStructure as fallback');
              try {
                const bodyLock = await client.getMailboxLock('INBOX');
                const fullMessage = await client.fetchOne(message.uid, {
                  source: true,
                  bodyParts: ['1']
                });
                bodyLock.release();
                
                if (fullMessage && fullMessage.bodyParts && fullMessage.bodyParts.size > 0) {
                  for (let [partId, bodyPart] of Array.from(fullMessage.bodyParts.entries())) {
                    if (bodyPart) {
                      bodyText = bodyPart.toString();
                      if (bodyText.trim().length > 0) break;
                    }
                  }
                }
              } catch (fetchError) {
                console.error('Error fetching full message:', fetchError);
              }
            }
          }
          
          // Final fallback - better than completely generic placeholder
          if (!bodyText || bodyText.trim().length === 0) {
            // At least provide some meaningful content
            const subject = envelope?.subject || 'No subject';
            const fromAddr = envelope?.from?.[0]?.address || 'unknown';
            bodyText = `[Content not available] Message from ${fromAddr} with subject: "${subject}"`;
            console.log('Using enhanced fallback for message:', message.uid);
          } else {
            console.log('Successfully extracted email body, length:', bodyText.length);
          }
          
          const rawEmail: RawEmail = {
            messageId: envelope?.messageId || `${message.uid}@${this.imapConfig.host}`,
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

          messages.push(rawEmail);
        }
        
        return messages; // Already in chronological order (oldest to newest)
        
      } finally {
        lock.release();
      }
      
    } finally {
      await client.logout();
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
    
    // Check if multipart and has non-text parts
    if (bodyStructure.type === 'multipart') {
      return bodyStructure.childNodes?.some((node: any) => 
        node.type !== 'text' || node.disposition === 'attachment'
      ) || false;
    }
    
    return bodyStructure.disposition === 'attachment';
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