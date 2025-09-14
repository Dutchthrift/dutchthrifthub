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
          uid: true,
          bodyParts: ['TEXT']
        })) {
          
          // Check if message has attachments
          console.log(`=== DEBUG: Checking message UID ${message.uid} for attachments ===`);
          console.log('bodyStructure:', JSON.stringify(message.bodyStructure, null, 2));
          const hasAttachment = this.checkForAttachments(message.bodyStructure);
          console.log(`=== DEBUG: hasAttachment result for UID ${message.uid}: ${hasAttachment} ===`);
          
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

          // Collect attachment descriptors if email has them (don't download yet to avoid IMAP deadlock)
          const attachmentDescriptors: Array<{
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

          if (hasAttachment) {
            console.log(`📎 Collecting attachment descriptors for Message UID ${message.uid}, Seq ${message.seq}, Subject: ${envelope?.subject || 'No subject'}`);
            const descriptors = this.collectAttachmentDescriptors(message, messages.length, message.seq);
            attachmentDescriptors.push(...descriptors);
            console.log(`📎 Found ${descriptors.length} attachment descriptors`);
          }

          // Store descriptors for later processing (after fetch loop completes)
          if (!attachmentQueue) {
            attachmentQueue = [];
          }
          attachmentQueue.push(...attachmentDescriptors);

          // Initialize extractedAttachments as empty for now
          (rawEmail as any).extractedAttachments = [];

          messages.push(rawEmail);
        }
        
        // Phase 2: Download attachments after fetch loop completes (avoids IMAP deadlock)
        console.log(`📎 Processing ${attachmentQueue.length} attachments in phase 2`);
        if (attachmentQueue.length > 0) {
          const { ObjectStorageService } = await import('../objectStorage.js');
          const objectStorageService = new ObjectStorageService();
          
          let processedCount = 0;
          for (const descriptor of attachmentQueue) {
            processedCount++;
            console.log(`📎 Processing attachment ${processedCount}/${attachmentQueue.length}: ${descriptor.filename}`);
            
            try {
              // Skip attachments over 10MB to prevent memory issues
              if (descriptor.size > 10 * 1024 * 1024) {
                console.log(`⚠️ Skipping large attachment ${descriptor.filename} (${descriptor.size} bytes)`);
                continue;
              }
              
              let attachmentBuffer: Buffer | undefined;
              
              // Helper function to add timeout to fetchOne operations
              const fetchWithTimeout = async (fetchPromise: Promise<any>, timeoutMs: number = 15000) => {
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error(`Fetch timeout after ${timeoutMs}ms`)), timeoutMs);
                });
                return Promise.race([fetchPromise, timeoutPromise]);
              };
              
              // Try sequence number first (more reliable within same session)
              try {
                console.log(`📥 Attempting sequence fetch: ${descriptor.filename} (Seq ${descriptor.seq}, part ${descriptor.partId})`);
                const result = await fetchWithTimeout(
                  client.fetchOne(descriptor.seq, {
                    uid: false, // Use sequence number
                    bodyParts: [descriptor.partId]
                  })
                );
                
                if (result && result.bodyParts) {
                  attachmentBuffer = result.bodyParts.get(descriptor.partId) as Buffer;
                  if (attachmentBuffer && attachmentBuffer.length > 0) {
                    console.log(`✅ Downloaded via sequence: ${descriptor.filename} (${attachmentBuffer.length} bytes)`);
                  }
                }
              } catch (seqError: any) {
                console.log(`⚠️ Sequence fetch failed for ${descriptor.filename}: ${seqError.message || seqError}`);
              }
              
              // Fallback to UID if sequence fetch failed or returned no data
              if (!attachmentBuffer || attachmentBuffer.length === 0) {
                try {
                  console.log(`🔄 Attempting UID fetch: ${descriptor.filename} (UID ${descriptor.uid}, part ${descriptor.partId})`);
                  const result = await fetchWithTimeout(
                    client.fetchOne(descriptor.uid, {
                      uid: true, // Use UID
                      bodyParts: [descriptor.partId]
                    })
                  );
                  
                  if (result && result.bodyParts) {
                    attachmentBuffer = result.bodyParts.get(descriptor.partId) as Buffer;
                    if (attachmentBuffer && attachmentBuffer.length > 0) {
                      console.log(`✅ Downloaded via UID: ${descriptor.filename} (${attachmentBuffer.length} bytes)`);
                    }
                  }
                } catch (uidError: any) {
                  console.log(`❌ UID fetch also failed for ${descriptor.filename}: ${uidError.message || uidError}`);
                }
              }
              
              if (attachmentBuffer && attachmentBuffer.length > 0) {
                try {
                  console.log(`💾 Saving attachment to object storage: ${descriptor.filename}`);
                  // Save to object storage with timeout
                  const storagePromise = objectStorageService.saveAttachment(
                    descriptor.filename,
                    attachmentBuffer,
                    descriptor.contentType
                  );
                  const storageUrl = await fetchWithTimeout(storagePromise, 20000); // 20 second timeout for storage
                  
                  // Add to the corresponding message's extractedAttachments
                  if (messages[descriptor.messageIndex]) {
                    const extractedAttachments = (messages[descriptor.messageIndex] as any).extractedAttachments || [];
                    extractedAttachments.push(storageUrl);
                    (messages[descriptor.messageIndex] as any).extractedAttachments = extractedAttachments;
                    
                    console.log(`📎 Added attachment to message[${descriptor.messageIndex}]: ${storageUrl}`);
                    console.log(`📎 Message[${descriptor.messageIndex}] now has ${extractedAttachments.length} attachments total`);
                  } else {
                    console.error(`❌ Could not find message at index ${descriptor.messageIndex} (total messages: ${messages.length})`);
                  }
                  
                  console.log(`✅ Saved attachment: ${descriptor.filename} to ${storageUrl}`);
                } catch (storageError: any) {
                  console.error(`❌ Failed to save attachment ${descriptor.filename} to storage: ${storageError.message || storageError}`);
                }
              } else {
                console.log(`⚠️ No attachment data could be downloaded for ${descriptor.filename}`);
              }
              
            } catch (attachmentError: any) {
              console.error(`❌ Error processing attachment ${descriptor.filename}:`, attachmentError.message || attachmentError);
              // Continue to next attachment even if this one fails
            }
            
            // Add a small delay to prevent overwhelming the IMAP server
            if (processedCount % 5 === 0) {
              console.log(`📊 Progress: ${processedCount}/${attachmentQueue.length} attachments processed`);
              await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay every 5 attachments
            }
          }
          
          console.log(`✅ Attachment processing completed: ${processedCount}/${attachmentQueue.length} attachments processed`);
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

  // Extract attachments from email message
  private async extractAttachments(client: any, message: any): Promise<Array<{ filename: string; data: Buffer; contentType?: string; contentId?: string; isInline: boolean }>> {
    console.log(`🔍 Starting attachment extraction for UID ${message.uid}`);
    const attachments: Array<{ filename: string; data: Buffer; contentType?: string; contentId?: string; isInline: boolean }> = [];
    
    if (!message.bodyStructure) {
      console.log(`❌ No bodyStructure found for UID ${message.uid}`);
      return attachments;
    }
    
    console.log(`🔍 bodyStructure found, processing...`);
    console.log(`🔍 bodyStructure has ${message.bodyStructure.childNodes?.length || 0} child nodes`);
    
    try {
      // Get the body structure to find attachments
      const bodyStructure = message.bodyStructure;
      
      // Recursive function to find all attachments in nested structures
      const processBodyPart = async (part: any) => {
        if (!part) return;
        
        const partId = part.part || '1';
        console.log(`Processing part ${partId}: type=${part.type}, disposition=${part.disposition}, name=${part.parameters?.name}, dispFilename=${part.dispositionParameters?.filename}`);
        
        // Check if this part is an attachment - use broader criteria
        const isAttachment = part.disposition === 'attachment' || 
                            part.disposition === 'inline' ||
                            (part.type && part.type.startsWith('image/')) ||
                            (part.type && !part.type.startsWith('text/'));
        
        // Use broader filename detection
        const hasFilename = part.parameters?.name || part.dispositionParameters?.filename;
        
        if (isAttachment && hasFilename) {
          try {
            console.log(`Downloading attachment part ${partId}...`);
            
            // Add timeout protection for IMAP downloads
            const downloadPromise = client.download(`${message.uid}`, partId, {
              uid: true
            });
            
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error(`Download timeout for part ${partId}`)), 30000); // 30 second timeout
            });
            
            // Race between download and timeout
            const attachmentData = await Promise.race([downloadPromise, timeoutPromise]);
            
            if (attachmentData && attachmentData.length > 0) {
              const filename = part.parameters?.name || part.dispositionParameters?.filename || `part-${partId}`;
              
              // Use proper content type detection
              const rawContentType = part.type || 'application/octet-stream';
              const contentType = rawContentType === 'application/octet-stream' 
                ? this.detectContentTypeFromFilename(filename) 
                : rawContentType;
              
              const contentId = part.id;
              const isInline = part.disposition === 'inline';
              
              attachments.push({
                filename,
                data: attachmentData,
                contentType,
                contentId,
                isInline
              });
              
              console.log(`✅ Extracted attachment: ${filename} (${contentType}, ${attachmentData.length} bytes)`);
            } else {
              console.log(`⚠️ No data received for attachment part ${partId}`);
            }
          } catch (downloadError: any) {
            console.error(`❌ Error downloading attachment part ${partId}:`, downloadError.message || downloadError);
            // Continue processing other parts even if one fails
          }
        }
        
        // Recursively process child nodes
        if (part.childNodes && Array.isArray(part.childNodes)) {
          for (const childPart of part.childNodes) {
            await processBodyPart(childPart);
          }
        }
      };
      
      // Start processing from the root
      if (bodyStructure.childNodes) {
        for (const childPart of bodyStructure.childNodes) {
          await processBodyPart(childPart);
        }
      } else {
        // Single part message
        await processBodyPart(bodyStructure);
      }
      
    } catch (error) {
      console.error('Error extracting attachments:', error);
    }
    
    return attachments;
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