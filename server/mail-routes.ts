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
    const { folder, starred, archived, isUnread, hasOrder, page = 1, limit = 50 } = req.query;

    try {
        const offset = (Number(page) - 1) * Number(limit);
        const result = await storage.getEmailThreads({
            limit: Number(limit),
            offset,
            folder: folder as string,
            starred: starred === 'true' ? true : starred === 'false' ? false : undefined,
            archived: archived === 'true' ? true : archived === 'false' ? false : undefined,
            isUnread: isUnread === 'true' ? true : isUnread === 'false' ? false : undefined,
            hasOrder: hasOrder === 'true' ? true : hasOrder === 'false' ? false : undefined
        });

        res.json(result);
    } catch (error: any) {
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

        res.json({
            customerEmail,
            orders: orders.slice(0, 10), // Limit to 10 most recent
            cases: cases.slice(0, 10),
            returns: returns.slice(0, 10)
        });
    } catch (error: any) {
        console.error('Error fetching context:', error);
        res.status(500).json({ message: error.message });
    }
});

// Toggle Thread Flags (starred, archived)

router.patch('/:id/flags', async (req, res) => {
    try {
        const { starred, archived } = req.body;
        const thread = await storage.getEmailThread(req.params.id);
        if (!thread) return res.status(404).json({ message: 'Thread not found' });

        const updated = await storage.updateEmailThread(thread.id, {
            starred: starred !== undefined ? starred : thread.starred,
            archived: archived !== undefined ? archived : thread.archived
        });

        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Get attachment data from Gmail
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

        const { gmailService } = await import('./services/gmailService');
        const attachmentData = await gmailService.getAttachment(messageId, attachmentId);

        if (!attachmentData) {
            return res.status(404).json({ message: 'Attachment not found' });
        }

        // attachmentData contains base64 encoded data
        const buffer = Buffer.from(attachmentData.data, 'base64');

        // Set appropriate content type
        res.setHeader('Content-Type', attachmentData.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${attachmentData.filename || 'attachment'}"`);
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
        // returns are not directly on email_threads schema in my previous view, 
        // but let's check if we should add it or if it's there.
        // The schema viewed earlier showed: orderId, caseId. 
        // It did NOT show returnId or repairId explicitly in the top level snippet I saw.
        // Let's check schema again if possible, or just try to update what we know.

        // Actually, looking at the schema view in history:
        // emailThreads has: customerId, orderId, caseId.
        // It does NOT have returnId or repairId.
        // However, CreateCaseModal tries to link 'case'.

        await storage.updateEmailThread(thread.id, updates);

        console.log(`[API] Linked thread ${thread.id} to ${type} ${entityId}`);
        res.json({ success: true });
    } catch (error: any) {
        console.error('Error linking thread:', error);
        res.status(500).json({ message: error.message });
    }
});

export default router;

