import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { storage } from '../storage';
import { emailThreads, emailMessages, mailThreadLinks } from '../../shared/schema';
import { OrderMatchingService, orderMatchingService } from './orderMatchingService';
import DOMPurify from 'isomorphic-dompurify';

class GmailService {
    private oauth2Client: OAuth2Client;
    private gmail: gmail_v1.Gmail;

    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GMAIL_CLIENT_ID,
            process.env.GMAIL_CLIENT_SECRET,
            process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback'
        );

        this.oauth2Client.setCredentials({
            refresh_token: process.env.GMAIL_REFRESH_TOKEN
        });

        this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    }

    /**
     * Performs the initial synchronization of the last 50 threads.
     */
    async initialSync() {
        console.log('[Gmail] Starting initial sync...');
        try {
            const res = await this.gmail.users.threads.list({
                userId: 'me',
                maxResults: 50,
                q: 'in:inbox OR in:sent'  // Sync both inbox and sent
            });


            const threads = res.data.threads || [];
            for (const t of threads) {
                if (t.id) {
                    await this.syncThread(t.id);
                }
            }
            console.log(`[Gmail] Initial sync completed: ${threads.length} threads processed.`);
        } catch (error) {
            console.error('[Gmail] Initial sync failed:', error);
            throw error;
        }
    }

    /**
     * Syncs a single thread by its ID, upserting the thread and all its messages.
     */
    async syncThread(threadId: string) {
        try {
            const threadRes = await this.gmail.users.threads.get({
                userId: 'me',
                id: threadId,
                format: 'full'
            });

            const threadData = threadRes.data;
            if (!threadData || !threadData.messages) return;

            const lastMessage = threadData.messages[threadData.messages.length - 1];
            const firstMessage = threadData.messages[0];

            const subject = this.getHeader(lastMessage, 'Subject') || '(No Subject)';
            const snippet = lastMessage.snippet || '';
            const lastMessageAt = new Date(parseInt(lastMessage.internalDate || Date.now().toString()));

            // Extract participants from all messages
            const participantsMap = new Map<string, { name: string; email: string }>();
            for (const msg of threadData.messages) {
                const from = this.parseAddress(this.getHeader(msg, 'From'));
                if (from) participantsMap.set(from.email, from);

                const to = this.parseAddress(this.getHeader(msg, 'To'));
                if (to) participantsMap.set(to.email, to);
            }
            const participants = Array.from(participantsMap.values());

            // Determine folder based on labels (SENT takes priority for outbound-only threads)
            const allLabels = threadData.messages.flatMap(m => m.labelIds || []);
            const uniqueLabels = Array.from(new Set(allLabels));
            const hasInbox = allLabels.includes('INBOX');
            const hasSent = allLabels.includes('SENT');

            // Stronger folder determination
            // 1. If it has the INBOX label, it's inbox
            // 2. If it has no INBOX label but has SENT label, it's sent
            // 3. Fallback: if the last message is inbound, it's inbox
            const lastMessageFrom = lastMessage.payload?.headers?.find((h: any) => h.name?.toLowerCase() === 'from')?.value || '';
            const gmailUser = process.env.GMAIL_USER || '';
            const isLastMessageOutbound = gmailUser && lastMessageFrom.toLowerCase().includes(gmailUser.toLowerCase());

            const isTrash = allLabels.includes('TRASH');
            const isSpam = allLabels.includes('SPAM');

            if (isTrash || isSpam) {
                console.log(`[Gmail] Skipping thread ${threadId} as it is marked as Trash/Spam (Labels: ${uniqueLabels.join(',')})`);
                // If it exists locally but is now trashed in Gmail, we should remove it locally too
                const existing = await storage.getEmailThreadByThreadId(threadId);
                if (existing) {
                    await storage.deleteEmailThread(existing.id);
                }
                return;
            }

            let folder: 'inbox' | 'sent' = hasInbox ? 'inbox' : (hasSent ? 'sent' : 'inbox');

            if (!isLastMessageOutbound && folder === 'sent' && !hasInbox) {
                // It's in 'sent' but the last message is from someone else.
                // This often happens during sync delays. Force it to inbox.
                folder = 'inbox';
            }

            // Upsert the thread
            const existingThread = await storage.getEmailThreadByThreadId(threadId);
            let dbThreadId: string;

            if (existingThread) {
                await storage.updateEmailThread(existingThread.id, {
                    subject,
                    snippet,
                    lastActivity: lastMessageAt,
                    participants,
                    messageCount: threadData.messages.length,
                    lastHistoryId: threadData.historyId || existingThread.lastHistoryId,
                    isUnread: threadData.messages.some(m => m.labelIds?.includes('UNREAD')),
                    folder // Ensure thread moves to correct folder if it changed (e.g. from sent to inbox)
                });
                dbThreadId = existingThread.id;
            } else {
                const newThread = await storage.createEmailThread({
                    threadId,
                    subject,
                    snippet,
                    lastActivity: lastMessageAt,
                    participants,
                    messageCount: threadData.messages.length,
                    lastHistoryId: threadData.historyId,
                    isUnread: threadData.messages.some(m => m.labelIds?.includes('UNREAD')),
                    status: 'open',
                    folder
                });
                dbThreadId = newThread.id;
            }


            // Sync all messages in the thread
            for (const msg of threadData.messages) {
                await this.upsertMessage(dbThreadId, msg);
            }

            // Auto-linking to orders (Disabled as per user request to avoid incorrect associations)
            // await this.autoLinkThread(dbThreadId, subject, threadData.messages);

        } catch (error) {
            console.error(`[Gmail] Error syncing thread ${threadId}:`, error);
        }
    }

    async markThreadAsRead(threadId: string) {
        try {
            // Find Gmail thread ID
            const thread = await storage.getEmailThread(threadId) || await storage.getEmailThreadByThreadId(threadId);
            if (!thread) {
                console.error(`[Gmail] Thread ${threadId} not found in DB`);
                return;
            }

            console.log(`[Gmail] Marking thread ${thread.threadId} as read...`);

            await this.gmail.users.threads.modify({
                userId: 'me',
                id: thread.threadId,
                requestBody: {
                    removeLabelIds: ['UNREAD']
                }
            });

            // Update local DB
            await storage.updateEmailThread(thread.id, { isUnread: false });
            console.log(`[Gmail] Thread ${thread.threadId} marked as read successfully.`);
        } catch (error) {
            console.error(`[Gmail] Error marking thread ${threadId} as read:`, error);
        }
    }

    async trashThread(threadId: string) {
        try {
            // Find Gmail thread ID
            const thread = await storage.getEmailThread(threadId) || await storage.getEmailThreadByThreadId(threadId);
            if (!thread) {
                console.error(`[Gmail] Thread ${threadId} not found in DB`);
                return;
            }

            console.log(`[Gmail] Trashing thread ${thread.threadId}...`);

            await this.gmail.users.threads.trash({
                userId: 'me',
                id: thread.threadId
            });

            // Update local DB
            await storage.deleteEmailThread(thread.id);
            console.log(`[Gmail] Thread ${thread.threadId} trashed successfully.`);
        } catch (error) {
            console.error(`[Gmail] Error trashing thread ${threadId}:`, error);
        }
    }

    /**
     * Uses history API to sync only what has changed since lastHistoryId.
     */
    async incrementalSync() {
        const lastThread = await storage.getLatestEmailThreadWithHistoryId();
        if (!lastThread || !lastThread.lastHistoryId) {
            return this.initialSync();
        }

        try {
            const res = await this.gmail.users.history.list({
                userId: 'me',
                startHistoryId: lastThread.lastHistoryId
            });

            if (!res.data.history) {
                console.log('[Gmail] No new history events.');
                return;
            }

            const changedThreadIds = new Set<string>();
            for (const record of res.data.history) {
                if (record.messagesAdded) {
                    record.messagesAdded.forEach(m => m.message?.threadId && changedThreadIds.add(m.message.threadId));
                }
                if (record.labelsAdded || record.labelsRemoved) {
                    // Could update read/unread status here
                    const updates = [...(record.labelsAdded || []), ...(record.labelsRemoved || [])];
                    updates.forEach(m => m.message?.threadId && changedThreadIds.add(m.message.threadId));
                }
            }

            for (const tId of Array.from(changedThreadIds)) {
                await this.syncThread(tId);
            }

            console.log(`[Gmail] Incremental sync completed: ${changedThreadIds.size} threads updated.`);
        } catch (error) {
            console.error('[Gmail] Incremental sync failed:', error);
            // Fallback to initial sync if history is expired
            if ((error as any).code === 404) {
                await this.initialSync();
            }
        }
    }

    private async upsertMessage(dbThreadId: string, msg: gmail_v1.Schema$Message) {
        if (!msg.id) return;

        const existingMsg = await storage.getEmailMessage(msg.id);
        if (existingMsg) return; // Messages don't change content in Gmail

        const from = this.parseAddress(this.getHeader(msg, 'From')) || { name: '', email: 'unknown@example.com' };
        const toRaw = this.getHeader(msg, 'To') || '';
        const to = toRaw.split(',').map(s => this.parseAddress(s.trim())).filter(Boolean);
        const ccRaw = this.getHeader(msg, 'Cc') || '';
        const cc = ccRaw ? ccRaw.split(',').map(s => this.parseAddress(s.trim())).filter(Boolean) : [];

        const date = new Date(parseInt(msg.internalDate || Date.now().toString()));
        const body = this.extractBody(msg);
        const bodyClean = this.cleanBody(body.text || body.html || '');

        await storage.createEmailMessage({
            messageId: msg.id,
            threadId: dbThreadId,
            fromName: from.name,
            fromEmail: from.email,
            toEmail: to[0]?.email || '',
            to: to as any,
            cc: cc as any,
            subject: this.getHeader(msg, 'Subject'),
            body: body.html || body.text || '',
            bodyText: body.text,
            bodyClean,
            snippet: msg.snippet,
            isHtml: !!body.html,
            isOutbound: (() => {
                const sender = from.email.toLowerCase();
                const myEmail = (process.env.GMAIL_USER || process.env.GMAIL_USER_EMAIL || '').toLowerCase();
                const myName = (process.env.GMAIL_NAME || 'Dutch Thrift Hub').toLowerCase();

                // Check if sender matches our email
                if (myEmail && sender.includes(myEmail)) return true;

                // Fallback: check if sender name looks like us
                if (from.name && from.name.toLowerCase().includes(myName)) return true;

                // Fallback default
                return sender.includes('support@');
            })(),
            sentAt: date,
            attachments: this.extractAttachmentsMetadata(msg) as any
        });
    }

    private extractBody(msg: gmail_v1.Schema$Message): { html?: string; text?: string } {
        let html = '';
        let text = '';

        const processPart = (part: gmail_v1.Schema$MessagePart) => {
            if (part.mimeType === 'text/html' && part.body?.data) {
                html = Buffer.from(part.body.data, 'base64').toString('utf-8');
            } else if (part.mimeType === 'text/plain' && part.body?.data) {
                text = Buffer.from(part.body.data, 'base64').toString('utf-8');
            }

            if (part.parts) {
                part.parts.forEach(processPart);
            }
        };

        if (msg.payload) {
            processPart(msg.payload);
        }

        // Sanitize HTML
        if (html) {
            html = DOMPurify.sanitize(html);
        }

        return { html, text };
    }

    private cleanBody(text: string): string {
        // Basic heuristic to strip common reply markers and signatures
        let clean = text;

        // Strip common HTML tags if it's HTML
        clean = clean.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        clean = clean.replace(/<[^>]+>/g, ' ');

        // Strip reply blocks (On ... wrote:, > quote, etc.)
        const replyMarkers = [
            /On\s.*\swrote:/i,
            /Op\s.*\sschreef:/i,
            /De\s:.*\sà\s:.*/i,
            /-----Original Message-----/i,
            /________________________________/
        ];

        for (const marker of replyMarkers) {
            const index = clean.search(marker);
            if (index !== -1) {
                clean = clean.substring(0, index);
            }
        }

        // Strip lines starting with >
        clean = clean.split('\n').filter(line => !line.trim().startsWith('>')).join('\n');

        return clean.trim();
    }

    private extractAttachmentsMetadata(msg: gmail_v1.Schema$Message) {
        const attachments: any[] = [];
        const processPart = (part: gmail_v1.Schema$MessagePart) => {
            if (part.filename && part.body?.attachmentId) {
                attachments.push({
                    gmailAttachmentId: part.body.attachmentId,
                    filename: part.filename,
                    mimeType: part.mimeType,
                    size: part.body.size
                });
            }
            if (part.parts) {
                part.parts.forEach(processPart);
            }
        };

        if (msg.payload) {
            processPart(msg.payload);
        }
        return attachments;
    }

    private getHeader(msg: gmail_v1.Schema$Message, name: string): string {
        const header = msg.payload?.headers?.find(h => h.name?.toLowerCase() === name.toLowerCase());
        return header?.value || '';
    }

    private parseAddress(raw: string): { name: string; email: string } | null {
        if (!raw) return null;
        const match = raw.match(/(?:"?([^"]*)"?\s)?(?:<(.+)>|(\S+@\S+))/);
        if (!match) return { name: '', email: raw };
        return {
            name: (match[1] || '').trim(),
            email: (match[2] || match[3] || '').trim()
        };
    }

    private async autoLinkThread(dbThreadId: string, subject: string, messages: gmail_v1.Schema$Message[]) {
        // Link by order number in subject or body
        const allText = subject + ' ' + messages.map(m => m.snippet || '').join(' ');
        const orderNumber = OrderMatchingService.extractOrderNumber(allText);

        if (orderNumber) {
            const order = await storage.getOrderByOrderNumber(orderNumber);
            if (order) {
                await storage.updateEmailThread(dbThreadId, { orderId: order.id });
                await storage.createMailThreadLink({
                    threadId: dbThreadId,
                    entityType: 'order',
                    entityId: order.id
                });
            }
        }

        // Link by customer email
        const customerEmail = messages[0]?.payload?.headers?.find(h => h.name === 'From')?.value;
        const parsed = this.parseAddress(customerEmail || '');
        if (parsed) {
            const customer = await storage.getCustomerByEmail(parsed.email);
            if (customer) {
                await storage.updateEmailThread(dbThreadId, { customerId: customer.id, customerEmail: customer.email });
            }
        }
    }

    /**
     * Fetches attachment data from Gmail API
     */
    async getAttachment(messageId: string, attachmentId: string): Promise<{ data: string; mimeType: string; filename: string } | null> {
        try {
            const res = await this.gmail.users.messages.attachments.get({
                userId: 'me',
                messageId,
                id: attachmentId
            });

            if (!res.data.data) return null;

            return {
                data: res.data.data,
                mimeType: 'application/octet-stream', // Default, route will overwrite from DB
                filename: 'attachment' // Default, route will overwrite from DB
            };
        } catch (error) {
            console.error('[Gmail] Error fetching attachment:', error);
            return null;
        }
    }

    /**
     * Send an email message (new or reply)
     */
    async sendMessage(options: {
        to: string;
        subject: string;
        body: string;
        threadId?: string;
        inReplyTo?: string;
        references?: string;
    }): Promise<{ messageId: string, threadId: string } | null> {
        try {
            const { threadId, to, subject, body, inReplyTo } = options;

            // Get the sender email (your Gmail account)
            const profile = await this.gmail.users.getProfile({ userId: 'me' });
            const fromEmail = profile.data.emailAddress;

            let realInReplyTo = inReplyTo;
            let realReferences = options.references;

            // If inReplyTo is a Gmail ID, fetch the actual Message-ID header for proper threading
            if (inReplyTo && !inReplyTo.includes('@')) {
                try {
                    const originalMsg = await this.gmail.users.messages.get({
                        userId: 'me',
                        id: inReplyTo,
                        format: 'metadata',
                        metadataHeaders: ['Message-ID', 'References']
                    });

                    const msgIdHeader = originalMsg.data.payload?.headers?.find(h => h.name?.toLowerCase() === 'message-id')?.value;
                    const referencesHeader = originalMsg.data.payload?.headers?.find(h => h.name?.toLowerCase() === 'references')?.value;

                    if (msgIdHeader) {
                        realInReplyTo = msgIdHeader;
                        realReferences = referencesHeader ? `${referencesHeader} ${msgIdHeader}` : msgIdHeader;
                    }
                } catch (e) {
                    console.warn('[Gmail] Could not fetch original message headers for reply threading:', e);
                }
            }

            // Build RFC 2822 formatted email
            const emailLines = [
                `From: ${fromEmail}`,
                `To: ${to}`,
                `Subject: ${subject}`,
                `MIME-Version: 1.0`,
                `Content-Type: text/html; charset=utf-8`,
            ];

            // Add reply headers if replying to a message
            if (realInReplyTo) {
                emailLines.push(`In-Reply-To: ${realInReplyTo}`);
            }
            if (realReferences) {
                emailLines.push(`References: ${realReferences}`);
            }

            // Add blank line and body
            emailLines.push('');
            emailLines.push(body);

            const rawEmail = emailLines.join('\r\n');

            // Base64url encode the email
            const encodedEmail = Buffer.from(rawEmail)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            // Send via Gmail API
            const res = await this.gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    threadId: threadId,
                    raw: encodedEmail
                }
            });

            console.log(`[Gmail] Message sent successfully. Message ID: ${res.data.id}, Thread ID: ${res.data.threadId}`);

            return {
                messageId: res.data.id || '',
                threadId: res.data.threadId || ''
            };
        } catch (error) {
            console.error('[Gmail] Error sending message:', error);
            throw error;
        }
    }
}

export const gmailService = new GmailService();
