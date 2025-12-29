import { Router } from 'express';
import { storage } from './storage';

const router = Router();

// ============================================
// MAIL SYSTEM ROUTES (Gmail API / IMAP fallback)
// ============================================

// Refresh Mailbox
router.post('/refresh', async (req, res) => {
    try {
        // Check if Gmail credentials are configured
        const hasGmailCreds = process.env.GMAIL_CLIENT_ID &&
            process.env.GMAIL_CLIENT_SECRET &&
            process.env.GMAIL_REFRESH_TOKEN;

        if (hasGmailCreds) {
            // Use Gmail API
            const { gmailService } = await import('./services/gmailService');
            const lastThread = await storage.getLatestEmailThreadWithHistoryId();

            if (!lastThread) {
                console.log('[API] No previous threads found, starting initial Gmail sync...');
                await gmailService.initialSync();
            } else {
                console.log(`[API] Found last history ID ${lastThread.lastHistoryId}, starting incremental Gmail sync...`);
                await gmailService.incrementalSync();
            }
            res.json({ message: 'Mailbox refreshed via Gmail API' });
        } else {
            // Fallback to IMAP if Gmail credentials not set
            console.log('[API] Gmail credentials not configured, using IMAP fallback...');

            const hasImapCreds = process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASS;
            if (!hasImapCreds) {
                return res.status(500).json({
                    message: 'Neither Gmail nor IMAP credentials are configured. Please add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN to your .env file, or configure IMAP_HOST, IMAP_USER, IMAP_PASS.'
                });
            }

            // Use IMAP sync (existing routes.ts logic can be called here)
            const { incrementalEmailSync } = await import('./services/incrementalEmailSync');
            await incrementalEmailSync();

            res.json({ message: 'Mailbox refreshed via IMAP' });
        }
    } catch (error: any) {
        console.error('❌ Error refreshing mailbox:', error);
        res.status(500).json({ message: error.message || 'Error refreshing mailbox' });
    }
});

// Send a reply to a thread
router.post('/reply', async (req, res) => {
    try {
        const { threadId, to, subject, body, inReplyTo, references } = req.body;

        if (!threadId || !to || !subject || !body) {
            return res.status(400).json({ message: 'threadId, to, subject, and body are required' });
        }

        // Check if Gmail credentials are configured
        const hasGmailCreds = process.env.GMAIL_CLIENT_ID &&
            process.env.GMAIL_CLIENT_SECRET &&
            process.env.GMAIL_REFRESH_TOKEN;

        if (!hasGmailCreds) {
            return res.status(500).json({ message: 'Gmail credentials not configured for sending emails' });
        }

        const { gmailService } = await import('./services/gmailService');

        // Get the thread to find the Gmail threadId
        const thread = await storage.getEmailThread(threadId);
        if (!thread) {
            return res.status(404).json({ message: 'Thread not found' });
        }

        const result = await gmailService.sendMessage({
            threadId: thread.threadId, // Gmail thread ID
            to,
            subject,
            body,
            inReplyTo,
            references
        });

        // Re-sync the thread to get the new message
        await gmailService.syncThread(thread.threadId);

        res.json({ success: true, messageId: result?.messageId });
    } catch (error: any) {
        console.error('Error sending reply:', error);
        res.status(500).json({ message: error.message || 'Failed to send reply' });
    }
});

// Compose a new email
router.post('/compose', async (req, res) => {
    try {
        const { to, subject, body } = req.body;

        if (!to || !subject || !body) {
            return res.status(400).json({ message: 'to, subject, and body are required' });
        }

        const { gmailService } = await import('./services/gmailService');

        const result = await gmailService.sendMessage({
            to,
            subject,
            body
        });

        if (result?.threadId) {
            // Wait a moment for Gmail to register the new message, then sync it
            setTimeout(() => {
                gmailService.syncThread(result.threadId).catch(console.error);
            }, 2000);
        }

        res.json({ success: true, messageId: result?.messageId, threadId: result?.threadId });
    } catch (error: any) {
        console.error('Error composing email:', error);
        res.status(500).json({ message: error.message || 'Failed to send email' });
    }
});


// List Email Threads

router.get('/list', async (req, res) => {
    const { folder, starred, archived, isUnread, hasOrder, hasCase, hasReturn, hasRepair, search, page = 1, limit = 50 } = req.query;

    console.log('[MAIL /list] Request received:', { folder, search, starred, archived });

    try {
        const offset = (Number(page) - 1) * Number(limit);
        const result = await storage.getEmailThreads({
            limit: Number(limit),
            offset,
            folder: folder as string,
            starred: starred === 'true' ? true : starred === 'false' ? false : undefined,
            archived: archived === 'true' ? true : archived === 'false' ? false : undefined,
            isUnread: isUnread === 'true' ? true : isUnread === 'false' ? false : undefined,
            hasOrder: hasOrder === 'true' ? true : hasOrder === 'false' ? false : undefined,
            hasCase: hasCase === 'true' ? true : hasCase === 'false' ? false : undefined,
            hasReturn: hasReturn === 'true' ? true : hasReturn === 'false' ? false : undefined,
            hasRepair: hasRepair === 'true' ? true : hasRepair === 'false' ? false : undefined,
            search: search as string
        });

        console.log('[MAIL /list] Returning', result.threads.length, 'threads out of', result.total);
        res.json(result);
    } catch (error: any) {
        console.error('[MAIL /list] Error:', error);
        res.status(500).json({ message: error.message });
    }
});



// Get Thread Details
router.get('/:id', async (req, res) => {
    try {
        const thread = await storage.getEmailThread(req.params.id);
        if (!thread) {
            return res.status(404).json({ message: 'Thread not found' });
        }

        const messages = await storage.getEmailMessages(thread.id);
        const links = await storage.getMailThreadLinks(thread.id);

        res.json({
            ...thread,
            messages,
            links
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Get related context (orders, cases, returns) for a thread based on sender email
router.get('/:id/context', async (req, res) => {
    try {
        const thread = await storage.getEmailThread(req.params.id);
        if (!thread) {
            return res.status(404).json({ message: 'Thread not found' });
        }

        // Get the sender email from the thread (first non-company participant)
        const participants = (thread.participants as any[]) || [];
        const companyEmails = ['contact@dutchthrift.com', 'info@dutchthrift.com', 'noreply@dutchthrift.com'];
        const customerEmail = participants.find(p => !companyEmails.includes(p.email?.toLowerCase()))?.email;

        if (!customerEmail && !thread.caseId && !thread.orderId) {
            return res.json({ orders: [], cases: [], returns: [], customerEmail: null });
        }

        // Find orders
        let orders: any[] = [];
        if (customerEmail) {
            orders = await storage.getOrdersByCustomerEmail(customerEmail);
        }
        // If thread has direct order link, add it (deduplicate)
        if (thread.orderId) {
            try {
                const linkedOrder = await storage.getOrder(thread.orderId);
                if (linkedOrder && !orders.find(o => o.id === linkedOrder.id)) {
                    orders.unshift(linkedOrder);
                }
            } catch (e) {
                console.error("Error fetching linked order", e);
            }
        }

        // Find cases
        let cases: any[] = [];
        if (customerEmail) {
            cases = await storage.getCasesByCustomerEmail(customerEmail);
        }
        // If thread has direct case link, add it
        if (thread.caseId) {
            try {
                const linkedCase = await storage.getCase(thread.caseId);
                if (linkedCase && !cases.find(c => c.id === linkedCase.id)) {
                    cases.unshift(linkedCase);
                }
            } catch (e) {
                console.error("Error fetching linked case", e);
            }
        }

        // Find returns by customer email
        const returns = customerEmail ? await storage.getReturnsByCustomerEmail(customerEmail) : [];

        // Find repairs
        const repairs = customerEmail ? await storage.getRepairsByCustomerEmail(customerEmail) : [];

        // Find existing thread links
        const currentLinks = await storage.getMailThreadLinks(thread.id);

        res.json({
            customerEmail,
            orders: orders.slice(0, 10), // Limit to 10 most recent
            cases: cases.slice(0, 10),
            returns: returns.slice(0, 10),
            repairs: repairs.slice(0, 10),
            currentLinks
        });
    } catch (error: any) {
        console.error('Error fetching context:', error);
        res.status(500).json({ message: error.message });
    }
});

// Toggle Thread Flags (starred, archived)

router.patch('/:id/flags', async (req, res) => {
    try {
        const { starred, archived, isUnread, actionDismissed } = req.body;
        const thread = await storage.getEmailThread(req.params.id);
        if (!thread) return res.status(404).json({ message: 'Thread not found' });

        const updates: any = {};
        if (starred !== undefined) updates.starred = starred;
        if (archived !== undefined) updates.archived = archived;
        if (isUnread !== undefined) updates.isUnread = isUnread;
        if (actionDismissed !== undefined) updates.actionDismissed = actionDismissed;

        const updated = await storage.updateEmailThread(thread.id, updates);

        // If marked as read, sync with Gmail
        if (isUnread === false) {
            const hasGmailCreds = process.env.GMAIL_CLIENT_ID &&
                process.env.GMAIL_CLIENT_SECRET &&
                process.env.GMAIL_REFRESH_TOKEN;

            if (hasGmailCreds) {
                const { gmailService } = await import('./services/gmailService');
                gmailService.markThreadAsRead(thread.id).catch(err => {
                    console.error('[API] Error syncing read status to Gmail:', err);
                });
            }
        }

        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Whitelist for safe in-browser previews
const ALLOWED_PREVIEW_MIMES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv'
];

router.get('/attachment/:messageId/:attachmentId', async (req, res) => {
    try {
        const { messageId, attachmentId } = req.params;

        // Check if Gmail credentials are configured
        const hasGmailCreds = process.env.GMAIL_CLIENT_ID &&
            process.env.GMAIL_CLIENT_SECRET &&
            process.env.GMAIL_REFRESH_TOKEN;

        if (!hasGmailCreds) {
            return res.status(500).json({ message: 'Gmail credentials not configured' });
        }

        const { storage } = await import('./storage');
        const { gmailService } = await import('./services/gmailService');

        // 1. Try to get metadata from our database first (more reliable)
        const message = await storage.getEmailMessage(messageId);
        let filename = 'attachment';
        let mimeType = 'application/octet-stream';

        if (message && message.attachments) {
            const att = (message.attachments as any[]).find(a => a.gmailAttachmentId === attachmentId);
            if (att) {
                filename = att.filename;
                mimeType = att.mimeType;
            }
        }

        // 2. Fetch the actual content from Gmail
        const attachmentData = await gmailService.getAttachment(messageId, attachmentId);

        if (!attachmentData) {
            return res.status(404).json({ message: 'Attachment not found' });
        }

        // Use metadata from attachmentData if it actually found something better than our fallback
        if (attachmentData.mimeType && attachmentData.mimeType !== 'application/octet-stream') {
            mimeType = attachmentData.mimeType;
        }
        if (attachmentData.filename && attachmentData.filename !== 'attachment') {
            filename = attachmentData.filename;
        }

        const detectedMime = mimeType.toLowerCase();
        const isSafePreview = ALLOWED_PREVIEW_MIMES.includes(detectedMime);

        // Security Headers
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // attachmentData contains base64 encoded data
        const buffer = Buffer.from(attachmentData.data, 'base64');

        // Set appropriate content type
        res.setHeader('Content-Type', detectedMime);

        // Content-Disposition: inline only for whitelisted safe types, otherwise attachment (forced download)
        const disposition = isSafePreview ? 'inline' : 'attachment';

        // RFC 5987 / 6266 improved filename handling for special characters
        res.setHeader('Content-Disposition', `${disposition}; filename="${filename.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.send(buffer);
    } catch (error: any) {
        console.error('Error fetching attachment:', error);
        res.status(500).json({ message: error.message });
    }
});

// Link Thread to Entity
router.post('/threads/:id/link', async (req, res) => {
    try {
        const { type, entityId } = req.body;
        const thread = await storage.getEmailThread(req.params.id);

        if (!thread) {
            return res.status(404).json({ message: 'Thread not found' });
        }

        const updates: any = {};
        if (type === 'case') updates.caseId = entityId;
        if (type === 'order') updates.orderId = entityId;
        if (type === 'return') updates.returnId = entityId;
        if (type === 'repair') updates.repairId = entityId;

        await storage.updateEmailThread(thread.id, updates);

        // Also add to flexible mailThreadLinks table
        await storage.createMailThreadLink({
            threadId: thread.id,
            entityType: type,
            entityId: entityId
        });

        console.log(`[API] Linked thread ${thread.id} to ${type} ${entityId}`);
        res.json({ success: true });
    } catch (error: any) {
        console.error('Error linking thread:', error);
        res.status(500).json({ message: error.message });
    }
});

// Unlink Email Thread
router.delete('/threads/:id/link', async (req, res) => {
    try {
        const { type, entityId } = req.body;
        const thread = await storage.getEmailThread(req.params.id);

        if (!thread) {
            return res.status(404).json({ message: 'Thread not found' });
        }

        const updates: any = {};
        if (type === 'case' && thread.caseId === entityId) updates.caseId = null;
        if (type === 'order' && thread.orderId === entityId) updates.orderId = null;

        if (Object.keys(updates).length > 0) {
            await storage.updateEmailThread(thread.id, updates);
        }

        // Also remove from flexible mailThreadLinks table
        await storage.deleteMailThreadLink(thread.id, type, entityId);

        console.log(`[API] Unlinked thread ${thread.id} from ${type} ${entityId}`);
        res.json({ success: true });
    } catch (error: any) {
        console.error('Error unlinking thread:', error);
        res.status(500).json({ message: error.message });
    }
});

// Delete Email Thread (Trash sync)
router.delete('/:id', async (req, res) => {
    try {
        const thread = await storage.getEmailThread(req.params.id);
        if (!thread) return res.status(404).json({ message: 'Thread not found' });

        const hasGmailCreds = process.env.GMAIL_CLIENT_ID &&
            process.env.GMAIL_CLIENT_SECRET &&
            process.env.GMAIL_REFRESH_TOKEN;

        if (hasGmailCreds) {
            const { gmailService } = await import('./services/gmailService');
            // This will also delete from local DB
            await gmailService.trashThread(req.params.id);
        } else {
            // Local delete only if no Gmail sync
            await storage.deleteEmailThread(req.params.id);
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting thread:', error);
        res.status(500).json({ message: error.message });
    }
});

// Rewrite Text
router.post('/rewrite', async (req, res) => {
    try {
        const { text, mode, threadId } = req.body;
        const { aiService } = await import('./services/aiService');

        // Optionally get context from thread if threadId provided
        let context = undefined;
        if (threadId) {
            const thread = await storage.getEmailThread(threadId);
            if (thread) {
                // We might need deep context later, but for now just pass threadId
            }
        }

        const rewritten = await aiService.rewriteText(text, mode, threadId);
        res.json({ success: true, rewritten });
    } catch (error: any) {
        console.error('Error rewriting text:', error);
        res.status(500).json({ message: error.message });
    }
});

// AI Analysis manual trigger
router.post('/:id/ai-analyze', async (req, res) => {
    try {
        const thread = await storage.getEmailThread(req.params.id);
        if (!thread) return res.status(404).json({ message: 'Thread not found' });

        const { aiService } = await import('./services/aiService');
        const result = await aiService.analyzeThread(thread.threadId);

        res.json({ success: true, result });
    } catch (error: any) {
        console.error('Error in manual AI analysis:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get AI Settings
router.get('/settings/ai', async (req, res) => {
    try {
        const { db } = await import('./services/database');
        const { aiSettings } = await import('@shared/schema');
        const settings = await db.query.aiSettings.findFirst();
        res.json(settings || {});
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Update AI Settings
router.patch('/settings/ai', async (req, res) => {
    try {
        const { db } = await import('./services/database');
        const { aiSettings } = await import('@shared/schema');
        const { eq } = await import('drizzle-orm');
        const existing = await db.query.aiSettings.findFirst();

        if (existing) {
            await db.update(aiSettings).set({
                ...req.body,
                updatedAt: new Date()
            }).where(eq(aiSettings.id, existing.id));
        } else {
            await db.insert(aiSettings).values({
                ...req.body,
                id: undefined // handled by default uuid
            });
        }
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

export default router;

