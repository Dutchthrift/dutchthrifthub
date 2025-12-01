// ============================================
// MAIL SYSTEM ROUTES (NEW)
// ============================================

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import DOMPurify from 'isomorphic-dompurify';

// POST /api/mail/refresh - Refresh mails from IMAP
app.post("/api/mail/refresh", requireAuth, async (req: any, res: any) => {
    try {
        // Rate limiting: max 1 refresh per 30s
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

        // Get IMAP credentials from env
        const imapHost = process.env.IMAP_HOST || 'imap.strato.de';
        const imapPort = parseInt(process.env.IMAP_PORT || '993');
        const imapUser = process.env.IMAP_USER;
        const imapPass = process.env.IMAP_PASS;

        if (!imapUser || !imapPass) {
            return res.status(500).json({ error: 'IMAP credentials not configured' });
        }

        // Connect to IMAP
        const client = new ImapFlow({
            host: imapHost,
            port: imapPort,
            secure: true,
            auth: {
                user: imapUser,
                pass: imapPass
            },
            logger: false
        });

        await client.connect();
        await client.mailboxOpen('INBOX');

        // Get last UID and sync status
        const lastUid = await storage.getSetting('mail_last_imap_uid');
        const initialSyncDone = await storage.getSetting('mail_initial_sync_done');

        // Determine query (initial sync vs incremental)
        const query = (!initialSyncDone || !lastUid) ? '1:*' : `${parseInt(lastUid) + 1}:*`;

        let newMailCount = 0;
        let maxUid = lastUid ? parseInt(lastUid) : 0;

        // Fetch emails
        for await (let msg of client.fetch(query, { source: true, uid: true })) {
            try {
                // Check if already exists (deduplication)
                const existing = await storage.getEmailByImapUid(msg.uid);
                if (existing) {
                    console.log(`Skipping duplicate email UID ${msg.uid}`);
                    continue;
                }

                // Parse email
                const parsed = await simpleParser(msg.source);

                // Sanitize HTML (server-side for security)
                const cleanHtml = DOMPurify.sanitize(parsed.html || '', {
                    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'img', 'div', 'span', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th'],
                    ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'style']
                });

                // Save email
                const email = await storage.createEmail({
                    subject: parsed.subject || '(No subject)',
                    fromName: parsed.from?.value?.[0]?.name || '',
                    fromEmail: parsed.from?.value?.[0]?.address || '',
                    html: cleanHtml,
                    text: parsed.text || '',
                    date: parsed.date || new Date(),
                    imapUid: msg.uid
                });

                // Save attachments if any
                if (parsed.attachments?.length) {
                    const attachmentData = [];

                    for (const att of parsed.attachments) {
                        // TODO: Save attachment to storage (Supabase or local)
                        // For now, just create metadata
                        const storagePath = `attachments/${email.id}/${att.filename}`;

                        attachmentData.push({
                            emailId: email.id,
                            filename: att.filename,
                            mimeType: att.contentType,
                            size: att.size,
                            storagePath: storagePath
                        });
                    }

                    if (attachmentData.length > 0) {
                        await storage.createEmailAttachmentBulk(attachmentData);
                    }
                }

                maxUid = Math.max(maxUid, msg.uid);
                newMailCount++;
            } catch (parseError) {
                console.error('Failed to parse email:', parseError);
                // Continue with next email
            }
        }

        await client.logout();

        // Update settings
        await storage.setSetting('mail_last_imap_uid', maxUid.toString());
        await storage.setSetting('mail_initial_sync_done', 'true');
        await storage.setSetting('mail_last_refresh_at', new Date().toISOString());

        // Keep only last 50 emails
        await storage.deleteOldEmails(50);

        res.json({
            success: true,
            newMails: newMailCount,
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

// GET /api/mail/list - Get last 50 emails
app.get("/api/mail/list", requireAuth, async (req: any, res: any) => {
    try {
        const emails = await storage.getEmails({ limit: 50, orderBy: 'date DESC' });
        res.json({ emails });
    } catch (error) {
        console.error('Error fetching emails:', error);
        res.status(500).json({ error: 'Failed to fetch emails' });
    }
});

// GET /api/mail/:id - Get single email with attachments and links
app.get("/api/mail/:id", requireAuth, async (req: any, res: any) => {
    try {
        const { id } = req.params;

        const email = await storage.getEmail(id);
        if (!email) {
            return res.status(404).json({ error: 'Email not found' });
        }

        const attachments = await storage.getEmailAttachmentsByEmailId(id);
        const links = await storage.getEmailLinks(id);

        res.json({
            ...email,
            attachments,
            links
        });
    } catch (error) {
        console.error('Error fetching email:', error);
        res.status(500).json({ error: 'Failed to fetch email' });
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
