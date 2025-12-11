// ============================================
// MAIL SYSTEM ROUTES (NEW)
// ============================================

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import DOMPurify from 'isomorphic-dompurify';

// Helper to build thread ID from headers (Gmail-style threading)
function buildThreadId(messageId: string, inReplyTo: string | undefined, references: string | undefined): string {
    if (references && references.trim()) {
        const refList = references.split(/\s+/).filter((r: string) => r.includes('@'));
        if (refList.length > 0) {
            return refList[0].replace(/[<>]/g, '');
        }
    }
    if (inReplyTo && inReplyTo.trim()) {
        return inReplyTo.replace(/[<>]/g, '');
    }
    return messageId.replace(/[<>]/g, '');
}

// Helper function to sync a single mailbox folder
async function syncMailbox(
    client: any,
    folderName: string,
    isOutbound: boolean,
    storage: any,
    startDate: Date
): Promise<{ count: number; maxUid: number }> {
    const settingKey = `mail_last_uid_${folderName.toLowerCase().replace(/[^a-z]/g, '_')}`;

    try {
        await client.mailboxOpen(folderName);
    } catch (err) {
        console.log(`⚠️ Could not open folder ${folderName}, skipping...`);
        return { count: 0, maxUid: 0 };
    }

    const lastUid = await storage.getSetting(settingKey);
    let newMailCount = 0;
    let maxUid = lastUid ? parseInt(lastUid) : 0;

    // Determine what UIDs to fetch
    let uidsToFetch: number[] = [];
    if (!lastUid) {
        console.log(`📧 [${folderName}] Initial sync: searching since ${startDate.toDateString()}`);
        const searchResults = await client.search({ since: startDate });
        uidsToFetch = searchResults || [];
    } else {
        console.log(`📧 [${folderName}] Incremental sync: UIDs > ${lastUid}`);
        const searchResults = await client.search({ uid: `${parseInt(lastUid) + 1}:*` });
        uidsToFetch = searchResults || [];
    }

    console.log(`📧 [${folderName}] Found ${uidsToFetch.length} emails to process`);

    if (uidsToFetch.length === 0) {
        return { count: 0, maxUid };
    }

    const BATCH_SIZE = 20;
    const DELAY_MS = 200;

    for (let i = 0; i < uidsToFetch.length; i += BATCH_SIZE) {
        const batchUids = uidsToFetch.slice(i, i + BATCH_SIZE);

        for await (let msg of client.fetch(batchUids, { source: true, uid: true, envelope: true })) {
            try {
                const msgDate = msg.envelope?.date;
                if (msgDate && new Date(msgDate) < startDate) {
                    continue;
                }

                const parsed = await simpleParser(msg.source);
                if (parsed.date && parsed.date < startDate) {
                    continue;
                }

                const messageId = parsed.messageId || `${msg.uid}@${folderName}`;

                // Check if message already exists
                const existingMessage = await storage.getEmailMessage(messageId);
                if (existingMessage) {
                    maxUid = Math.max(maxUid, msg.uid);
                    continue;
                }

                const cleanHtml = DOMPurify.sanitize(parsed.html || '', {
                    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'img', 'div', 'span', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th'],
                    ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'style']
                });

                const inReplyTo = parsed.inReplyTo;
                const references = Array.isArray(parsed.references)
                    ? parsed.references.join(' ')
                    : (parsed.references || '');

                // Gmail-style threading: extract ALL related Message-IDs
                const allRelatedIds: string[] = [];

                // Add all References
                if (references.trim()) {
                    const refs = references.split(/\s+/)
                        .filter((r: string) => r.includes('@'))
                        .map((r: string) => r.replace(/[<>]/g, ''));
                    allRelatedIds.push(...refs);
                }

                // Add In-Reply-To
                if (inReplyTo?.trim()) {
                    allRelatedIds.push(inReplyTo.replace(/[<>]/g, ''));
                }

                // Add own Message-ID
                const cleanMessageId = messageId.replace(/[<>]/g, '');
                allRelatedIds.push(cleanMessageId);

                const fromEmail = parsed.from?.value?.[0]?.address || '';
                const toEmail = parsed.to?.value?.[0]?.address || '';

                // Save to main emails table
                const email = await storage.createEmail({
                    subject: parsed.subject || '(No subject)',
                    fromName: parsed.from?.value?.[0]?.name || '',
                    fromEmail: fromEmail,
                    html: cleanHtml,
                    text: parsed.text || '',
                    date: parsed.date || new Date(),
                    imapUid: msg.uid
                });

                // Gmail-style: Find existing thread by checking ALL related Message-IDs
                let thread = null;
                for (const refId of allRelatedIds) {
                    thread = await storage.getEmailThreadByThreadId(refId);
                    if (thread) break;
                }

                // If no existing thread found, create new one using own Message-ID
                if (!thread) {
                    thread = await storage.createEmailThread({
                        threadId: cleanMessageId,
                        subject: parsed.subject || '(No subject)',
                        customerEmail: isOutbound ? toEmail : fromEmail,
                        status: 'open',
                        isUnread: !isOutbound,
                        lastActivity: parsed.date || new Date(),
                        hasAttachment: (parsed.attachments?.length || 0) > 0,
                    });
                } else if (parsed.date && parsed.date > (thread.lastActivity || new Date(0))) {
                    await storage.updateEmailThread(thread.id, {
                        lastActivity: parsed.date,
                        isUnread: !isOutbound && thread.isUnread
                    });
                }

                // Create email message with isOutbound flag
                await storage.createEmailMessage({
                    messageId: messageId,
                    threadId: thread.id,
                    fromEmail: fromEmail,
                    toEmail: toEmail,
                    subject: parsed.subject || '(No subject)',
                    body: cleanHtml || parsed.text || '',
                    isHtml: !!cleanHtml,
                    sentAt: parsed.date || new Date(),
                    isOutbound: isOutbound,
                });

                // Save attachments
                if (parsed.attachments?.length) {
                    const attachmentData = parsed.attachments.map(att => ({
                        emailId: email.id,
                        filename: att.filename,
                        mimeType: att.contentType,
                        size: att.size,
                        storagePath: `attachments/${email.id}/${att.filename}`
                    }));
                    await storage.createEmailAttachmentBulk(attachmentData);
                }

                maxUid = Math.max(maxUid, msg.uid);
                newMailCount++;

            } catch (parseError) {
                console.error(`Failed to parse email in ${folderName}:`, parseError);
            }
        }

        if (i + BATCH_SIZE < uidsToFetch.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }

    // Save the max UID for this folder
    if (maxUid > 0) {
        await storage.setSetting(settingKey, maxUid.toString());
    }

    return { count: newMailCount, maxUid };
}

// POST /api/mail/refresh - Refresh mails from IMAP (INBOX + SENT)
app.post("/api/mail/refresh", requireAuth, async (req: any, res: any) => {
    try {
        // Rate limiting
        const lastRefreshAt = await storage.getSetting('mail_last_refresh_at');
        if (lastRefreshAt) {
            const timeSinceLastRefresh = Date.now() - new Date(lastRefreshAt).getTime();
            if (timeSinceLastRefresh < 30000) {
                return res.status(429).json({
                    error: 'Please wait 30 seconds between refreshes',
                    retryAfter: Math.ceil((30000 - timeSinceLastRefresh) / 1000)
                });
            }
        }

        const imapHost = process.env.IMAP_HOST || 'imap.strato.de';
        const imapPort = parseInt(process.env.IMAP_PORT || '993');
        const imapUser = process.env.IMAP_USER;
        const imapPass = process.env.IMAP_PASS;

        if (!imapUser || !imapPass) {
            return res.status(500).json({ error: 'IMAP credentials not configured' });
        }

        const client = new ImapFlow({
            host: imapHost,
            port: imapPort,
            secure: true,
            auth: { user: imapUser, pass: imapPass },
            logger: false
        });

        await client.connect();

        const startDate = new Date('2025-01-01');
        let totalNewMails = 0;

        // Sync INBOX (inbound emails)
        console.log('📥 Syncing INBOX...');
        const inboxResult = await syncMailbox(client, 'INBOX', false, storage, startDate);
        totalNewMails += inboxResult.count;
        console.log(`📥 INBOX: ${inboxResult.count} new emails`);

        // Sync SENT folder (outbound emails) - try common folder names
        const sentFolderNames = ['INBOX.Sent', 'Sent', 'Sent Items', 'Sent Messages', 'INBOX.Sent Items'];
        for (const sentFolder of sentFolderNames) {
            try {
                console.log(`📤 Trying SENT folder: ${sentFolder}...`);
                const sentResult = await syncMailbox(client, sentFolder, true, storage, startDate);
                totalNewMails += sentResult.count;
                console.log(`📤 ${sentFolder}: ${sentResult.count} new emails`);
                break; // Found a working sent folder
            } catch (err) {
                // Try next folder name
            }
        }

        await client.logout();

        await storage.setSetting('mail_last_refresh_at', new Date().toISOString());

        console.log(`✅ Mail sync complete: ${totalNewMails} total new emails`);

        res.json({
            success: true,
            newMails: totalNewMails,
            lastSync: new Date()
        });

    } catch (error: any) {
        console.error('Mail refresh error:', error);

        if (error.code === 'ETIMEDOUT') {
            return res.status(503).json({ error: 'IMAP server timeout' });
        }

        res.status(500).json({
            error: 'Failed to refresh mails',
            message: error.message
        });
    }
});

// GET /api/mail/list - Get email threads (not individual emails)
// Thread-first architecture: list shows threads, each with latest message preview
app.get("/api/mail/list", requireAuth, async (req: any, res: any) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        // Get threads with pagination
        const { threads, total } = await storage.getEmailThreads({
            limit,
            offset,
            folder: 'inbox'
        });

        // For each thread, get the latest message for preview
        const threadsWithPreview = await Promise.all(threads.map(async (thread) => {
            const messages = await storage.getEmailMessages(thread.id);
            const latestMessage = messages.sort((a, b) => {
                const dateA = new Date(a.sentAt || a.createdAt || 0);
                const dateB = new Date(b.sentAt || b.createdAt || 0);
                return dateB.getTime() - dateA.getTime(); // Most recent first
            })[0];

            return {
                ...thread,
                messageCount: messages.length,
                latestMessage: latestMessage ? {
                    id: latestMessage.id,
                    fromEmail: latestMessage.fromEmail,
                    body: latestMessage.body?.substring(0, 200) || '',
                    sentAt: latestMessage.sentAt,
                    isOutbound: latestMessage.isOutbound
                } : null,
                // For backwards compatibility with existing UI
                id: thread.id,
                subject: thread.subject,
                fromEmail: thread.customerEmail,
                fromName: thread.customerEmail?.split('@')[0] || '',
                date: thread.lastActivity,
                html: latestMessage?.body || '',
                text: latestMessage?.body?.replace(/<[^>]*>/g, '') || ''
            };
        }));

        res.json({
            emails: threadsWithPreview, // Use 'emails' key for backwards compatibility
            threads: threadsWithPreview,
            total
        });
    } catch (error) {
        console.error('Error fetching email threads:', error);
        res.status(500).json({ error: 'Failed to fetch emails' });
    }
});

// GET /api/mail/:id - Get thread with all messages
// Thread-first architecture: clicking a thread shows all messages in conversation
app.get("/api/mail/:id", requireAuth, async (req: any, res: any) => {
    try {
        const { id } = req.params;

        // First, try to find as a thread
        let thread = await storage.getEmailThread(id);

        if (!thread) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        // Get all messages in the thread
        const messages = await storage.getEmailMessages(thread.id);
        const sortedMessages = messages.sort((a: any, b: any) => {
            const dateA = new Date(a.sentAt || a.createdAt || 0);
            const dateB = new Date(b.sentAt || b.createdAt || 0);
            return dateA.getTime() - dateB.getTime(); // Oldest first for conversation flow
        });

        // Get the latest message for header info
        const latestMessage = sortedMessages[sortedMessages.length - 1];

        res.json({
            // Thread info
            id: thread.id,
            threadId: thread.threadId,
            subject: thread.subject,
            customerEmail: thread.customerEmail,
            status: thread.status,
            isUnread: thread.isUnread,
            starred: thread.starred,
            hasAttachment: thread.hasAttachment,
            lastActivity: thread.lastActivity,
            createdAt: thread.createdAt,

            // For backwards compatibility with existing UI
            fromEmail: thread.customerEmail,
            fromName: thread.customerEmail?.split('@')[0] || '',
            date: thread.lastActivity,
            html: latestMessage?.body || '',
            text: latestMessage?.body?.replace(/<[^>]*>/g, '') || '',

            // Thread messages
            messages: sortedMessages,
            messageCount: sortedMessages.length,

            // Attachments (from all messages)
            attachments: sortedMessages.flatMap((m: any) => m.attachments || []),

            // Links (if any)
            links: []
        });
    } catch (error) {
        console.error('Error fetching thread:', error);
        res.status(500).json({ error: 'Failed to fetch thread' });
    }
});


// POST /api/mail/link - Link email to entity (order/case/return/repair)
app.post("/api/mail/link", requireAuth, async (req: any, res: any) => {
    try {
        const { emailId, entityType, entityId } = req.body;

        if (!emailId || !entityType || !entityId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const link = await storage.createEmailLink({
            emailId,
            entityType,
            entityId
        });

        await auditLog(req, "LINK", "email_links", link.id, {
            emailId,
            entityType,
            entityId
        });

        res.status(201).json({ link });
    } catch (error) {
        console.error('Error linking email:', error);
        res.status(400).json({ error: 'Failed to link email' });
    }
});
