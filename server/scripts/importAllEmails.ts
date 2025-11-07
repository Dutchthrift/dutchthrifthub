import { ImapFlow } from 'imapflow';
import { storage } from '../storage';
import { ObjectStorageService } from '../objectStorage';

interface EmailAttachment {
  uid: number;
  seq: number;
  partId: string;
  filename: string;
  contentType: string;
  contentId?: string;
  isInline: boolean;
  size: number;
}

interface ParsedEmail {
  messageId: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  date: Date;
  bodyText: string;
  bodyHtml: string;
  attachments: EmailAttachment[];
  inReplyTo?: string;
  references: string[];
  isRead: boolean;
}

export async function importAllEmails() {
  console.log('Starting email import from 2025-01-01...');
  
  const imapConfig = {
    host: (process.env.IMAP_HOST || '').trim(),
    port: parseInt(process.env.IMAP_PORT || '993'),
    secure: true,
    auth: {
      user: (process.env.IMAP_USER || '').trim(),
      pass: (process.env.IMAP_PASS || '').trim()
    }
  };

  const client = new ImapFlow(imapConfig);
  
  client.on('error', (err) => {
    console.error('IMAP client error:', err);
  });

  try {
    console.log('Connecting to IMAP server...');
    await client.connect();
    
    const lock = await client.getMailboxLock('INBOX');
    
    try {
      // Search for all emails since January 1, 2025
      const searchDate = new Date('2025-01-01');
      console.log(`Searching for emails since ${searchDate.toISOString()}...`);
      
      const searchResult = await client.search({ since: searchDate });
      const uids = Array.isArray(searchResult) ? searchResult : [];
      
      console.log(`Found ${uids.length} emails to import`);
      
      if (uids.length === 0) {
        console.log('No emails found');
        return { success: true, imported: 0 };
      }

      const emails: ParsedEmail[] = [];
      const attachmentQueue: EmailAttachment[] = [];
      
      // Fetch emails in batches of 50
      const batchSize = 50;
      for (let i = 0; i < uids.length; i += batchSize) {
        const batchUids = uids.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uids.length / batchSize)} (${batchUids.length} emails)...`);
        
        for await (const message of client.fetch(batchUids, {
          envelope: true,
          flags: true,
          bodyStructure: true,
          uid: true,
          source: false
        })) {
          try {
            const envelope = message.envelope;
            if (!envelope) continue;
            
            // Extract basic info
            const messageId = envelope.messageId || `generated-${message.uid}@dutchthrift.com`;
            const from = envelope.from?.[0]?.address || 'unknown@unknown.com';
            const to = envelope.to?.map(addr => addr.address || '') || [];
            const cc = envelope.cc?.map(addr => addr.address || '') || [];
            const subject = envelope.subject || '(No Subject)';
            const date = envelope.date || new Date();
            const isRead = message.flags?.has('\\Seen') || false;
            
            // Extract threading info
            const inReplyTo = envelope.inReplyTo;
            const references: string[] = [];

            // Find text parts in body structure
            let bodyText = '';
            let bodyHtml = '';
            
            const findTextParts = (part: any, partId = '1'): Array<{ partId: string; type: string; encoding: string }> => {
              const parts: Array<{ partId: string; type: string; encoding: string }> = [];
              
              if (part.type === 'text/plain' || part.type === 'text/html') {
                parts.push({
                  partId,
                  type: part.type,
                  encoding: part.encoding || '7bit'
                });
              }
              
              if (part.childNodes && Array.isArray(part.childNodes)) {
                part.childNodes.forEach((child: any, index: number) => {
                  const childPartId = partId ? `${partId}.${index + 1}` : `${index + 1}`;
                  parts.push(...findTextParts(child, childPartId));
                });
              }
              
              return parts;
            };

            const textParts = findTextParts(message.bodyStructure);
            const htmlPart = textParts.find(p => p.type === 'text/html');
            const plainPart = textParts.find(p => p.type === 'text/plain');
            
            // Download body content with timeout
            const downloadBodyPart = async (partId: string, encoding: string): Promise<string> => {
              try {
                const timeoutMs = 10000;
                const timeoutPromise = new Promise<never>((_, reject) => {
                  setTimeout(() => reject(new Error(`Download timeout after ${timeoutMs}ms`)), timeoutMs);
                });
                
                const downloadPromise = async () => {
                  const { content: stream } = await client.download(message.uid, partId);
                  const chunks: Buffer[] = [];
                  for await (const chunk of stream) {
                    chunks.push(chunk);
                  }
                  return Buffer.concat(chunks);
                };
                
                const contentBuffer = await Promise.race([downloadPromise(), timeoutPromise]);
                return decodeContent(contentBuffer, encoding);
              } catch (error) {
                console.error(`Error downloading part ${partId} for UID ${message.uid}:`, error);
                return '';
              }
            };

            if (htmlPart) {
              bodyHtml = await downloadBodyPart(htmlPart.partId, htmlPart.encoding);
            }
            if (plainPart) {
              bodyText = await downloadBodyPart(plainPart.partId, plainPart.encoding);
            }

            // Find attachments
            const findAttachments = (part: any, partId = '1'): EmailAttachment[] => {
              const attachments: EmailAttachment[] = [];
              
              if (part.disposition === 'attachment' || part.disposition === 'inline') {
                const filename = part.dispositionParameters?.filename || part.parameters?.name || 'unnamed';
                const contentType = part.type || 'application/octet-stream';
                const contentId = part.id;
                const size = part.size || 0;
                
                attachments.push({
                  uid: message.uid,
                  seq: message.seq,
                  partId,
                  filename,
                  contentType,
                  contentId,
                  isInline: part.disposition === 'inline',
                  size
                });
              }
              
              if (part.childNodes && Array.isArray(part.childNodes)) {
                part.childNodes.forEach((child: any, index: number) => {
                  const childPartId = partId ? `${partId}.${index + 1}` : `${index + 1}`;
                  attachments.push(...findAttachments(child, childPartId));
                });
              }
              
              return attachments;
            };

            const messageAttachments = findAttachments(message.bodyStructure);
            attachmentQueue.push(...messageAttachments);

            emails.push({
              messageId,
              from,
              to,
              cc,
              subject,
              date,
              bodyText,
              bodyHtml,
              attachments: messageAttachments,
              inReplyTo,
              references,
              isRead
            });
            
            if (emails.length % 10 === 0) {
              console.log(`Parsed ${emails.length}/${uids.length} emails...`);
            }
          } catch (error) {
            console.error(`Error parsing email UID ${message.uid}:`, error);
          }
        }
      }

      console.log(`Successfully parsed ${emails.length} emails`);
      console.log(`Found ${attachmentQueue.length} attachments to download`);

      // Download attachments
      const objectStorage = new ObjectStorageService();
      const attachmentMap = new Map<string, string>();

      if (attachmentQueue.length > 0) {
        console.log('Downloading attachments...');
        let downloadedCount = 0;
        
        for (const attachment of attachmentQueue) {
          try {
            const timeoutMs = 15000;
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error(`Attachment download timeout`)), timeoutMs);
            });
            
            const downloadPromise = async () => {
              const { content: stream } = await client.download(attachment.uid, attachment.partId);
              const chunks: Buffer[] = [];
              for await (const chunk of stream) {
                chunks.push(chunk);
              }
              return Buffer.concat(chunks);
            };
            
            const buffer = await Promise.race([downloadPromise(), timeoutPromise]);
            const key = `${attachment.uid}-${attachment.partId}`;
            
            const storageUrl = await objectStorage.saveAttachment(
              attachment.filename,
              buffer,
              attachment.contentType
            );
            
            attachmentMap.set(key, storageUrl);
            downloadedCount++;
            
            if (downloadedCount % 10 === 0) {
              console.log(`Downloaded ${downloadedCount}/${attachmentQueue.length} attachments...`);
            }
          } catch (error) {
            console.error(`Error downloading attachment ${attachment.filename}:`, error);
          }
        }
        
        console.log(`Successfully downloaded ${downloadedCount} attachments`);
      }

      // Import into database
      console.log('Importing emails into database...');
      await importEmailsToDatabase(emails, attachmentMap);
      
      console.log(`Import complete! Imported ${emails.length} emails`);
      return { success: true, imported: emails.length };
      
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error('Error during email import:', error);
    throw error;
  } finally {
    await client.logout();
  }
}

function decodeContent(buffer: Buffer, encoding: string): string {
  try {
    switch (encoding?.toLowerCase()) {
      case 'base64':
        return Buffer.from(buffer.toString(), 'base64').toString('utf-8');
      case 'quoted-printable':
        return buffer.toString('utf-8').replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, hex) => 
          String.fromCharCode(parseInt(hex, 16))
        );
      case '7bit':
      case '8bit':
      case 'binary':
      default:
        return buffer.toString('utf-8');
    }
  } catch (error) {
    console.error('Error decoding content:', error);
    return buffer.toString('utf-8');
  }
}

async function importEmailsToDatabase(emails: ParsedEmail[], attachmentMap: Map<string, string>) {
  // Group emails into threads
  const threadMap = new Map<string, ParsedEmail[]>();
  
  for (const email of emails) {
    // Try to find thread based on references, in-reply-to, or subject
    let threadKey: string | null = null;
    
    if (email.inReplyTo) {
      threadKey = email.inReplyTo;
    } else if (email.references && email.references.length > 0) {
      threadKey = email.references[0];
    } else {
      // Create thread key from normalized subject
      const normalizedSubject = email.subject
        .replace(/^(re:|fwd?:|aw:)\s*/i, '')
        .trim()
        .toLowerCase();
      threadKey = `subject:${normalizedSubject}`;
    }
    
    if (!threadMap.has(threadKey)) {
      threadMap.set(threadKey, []);
    }
    threadMap.get(threadKey)!.push(email);
  }

  console.log(`Grouped ${emails.length} emails into ${threadMap.size} threads`);

  // Import each thread
  let importedThreads = 0;
  let importedMessages = 0;
  
  for (const [threadKey, threadEmails] of Array.from(threadMap.entries())) {
    try {
      // Sort by date
      threadEmails.sort((a: ParsedEmail, b: ParsedEmail) => a.date.getTime() - b.date.getTime());
      
      const firstEmail = threadEmails[0];
      const lastEmail = threadEmails[threadEmails.length - 1];
      
      // Determine participants
      const allParticipants = new Set<string>();
      threadEmails.forEach((email: ParsedEmail) => {
        allParticipants.add(email.from);
        email.to.forEach((addr: string) => allParticipants.add(addr));
        email.cc.forEach((addr: string) => allParticipants.add(addr));
      });
      
      // Determine status
      const hasUnread = threadEmails.some((e: ParsedEmail) => !e.isRead);
      const status = hasUnread ? 'open' : 'closed';
      
      // Check if thread already exists
      const existingThreads = await storage.getEmailThreads({});
      const existingThread = existingThreads.find(t => 
        t.subject === firstEmail.subject && 
        t.lastActivity && 
        Math.abs(new Date(t.lastActivity).getTime() - lastEmail.date.getTime()) < 60000
      );
      
      let threadId: string;
      
      if (existingThread) {
        threadId = existingThread.id;
        console.log(`Thread already exists: ${firstEmail.subject}`);
      } else {
        // Create thread
        const thread = await storage.createEmailThread({
          threadId: threadKey,
          subject: firstEmail.subject,
          customerEmail: firstEmail.from,
          status,
          lastActivity: lastEmail.date,
          hasAttachment: threadEmails.some((e: ParsedEmail) => e.attachments.length > 0),
          customerId: null,
          assignedUserId: null,
          priority: 'medium',
          isUnread: hasUnread,
          folder: 'inbox',
          starred: false,
          archived: false
        });
        
        threadId = thread.id;
        importedThreads++;
      }
      
      // Import messages
      for (const email of threadEmails) {
        // Check if message already exists
        const existingMessages = await storage.getEmailMessages(threadId);
        const messageExists = existingMessages.some(m => m.messageId === email.messageId);
        
        if (messageExists) {
          console.log(`Message already exists: ${email.messageId}`);
          continue;
        }
        
        // Map attachments
        const messageAttachments = email.attachments.map((att: EmailAttachment) => {
          const key = `${att.uid}-${att.partId}`;
          const url = attachmentMap.get(key);
          return {
            filename: att.filename,
            contentType: att.contentType,
            size: att.size,
            url: url || '',
            contentId: att.contentId
          };
        }).filter((att: any) => att.url);
        
        await storage.createEmailMessage({
          threadId,
          messageId: email.messageId,
          fromEmail: email.from,
          toEmail: email.to.join(', '),
          subject: email.subject,
          body: email.bodyHtml || email.bodyText,
          isHtml: !!email.bodyHtml,
          isOutbound: false,
          attachments: messageAttachments,
          sentAt: email.date
        });
        
        importedMessages++;
      }
      
      if (importedThreads % 10 === 0) {
        console.log(`Imported ${importedThreads} threads, ${importedMessages} messages...`);
      }
    } catch (error) {
      console.error(`Error importing thread:`, error);
    }
  }
  
  console.log(`Database import complete: ${importedThreads} threads, ${importedMessages} messages`);
}
