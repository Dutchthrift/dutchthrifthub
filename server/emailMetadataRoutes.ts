import express from 'express';
import { db } from '../db';
import { emailMetadata } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

/**
 * POST /api/email-metadata
 * Store metadata linking an email to ThriftHub entities
 */
router.post("/api/email-metadata", async (req, res) => {
    try {
        const {
            messageId,
            threadId,
            caseId,
            orderId,
            returnId,
            repairId,
            subject,
            fromEmail,
            toEmail
        } = req.body;

        if (!messageId) {
            return res.status(400).json({ error: "messageId is required" });
        }

        // Check if metadata already exists
        const existing = await db.select()
            .from(emailMetadata)
            .where(eq(emailMetadata.messageId, messageId))
            .limit(1);

        let result;

        if (existing.length > 0) {
            // Update existing metadata
            result = await db.update(emailMetadata)
                .set({
                    threadId: threadId || existing[0].threadId,
                    caseId: caseId || existing[0].caseId,
                    orderId: orderId || existing[0].orderId,
                    returnId: returnId || existing[0].returnId,
                    repairId: repairId || existing[0].repairId,
                    subject: subject || existing[0].subject,
                    fromEmail: fromEmail || existing[0].fromEmail,
                    toEmail: toEmail || existing[0].toEmail,
                    updatedAt: new Date()
                })
                .where(eq(emailMetadata.messageId, messageId))
                .returning();
        } else {
            // Create new metadata
            result = await db.insert(emailMetadata).values({
                messageId,
                threadId,
                caseId,
                orderId,
                returnId,
                repairId,
                subject,
                fromEmail,
                toEmail
            }).returning();
        }

        res.json({
            success: true,
            metadata: result[0]
        });

    } catch (error) {
        console.error("Error storing email metadata:", error);
        res.status(500).json({ error: "Failed to store email metadata" });
    }
});

/**
 * GET /api/email-metadata/:messageId
 * Retrieve metadata for a specific email
 */
router.get("/api/email-metadata/:messageId", async (req, res) => {
    try {
        const { messageId } = req.params;

        const result = await db.select()
            .from(emailMetadata)
            .where(eq(emailMetadata.messageId, messageId))
            .limit(1);

        if (result.length === 0) {
            return res.status(404).json({ error: "Email metadata not found" });
        }

        res.json(result[0]);

    } catch (error) {
        console.error("Error fetching email metadata:", error);
        res.status(500).json({ error: "Failed to fetch email metadata" });
    }
});

/**
 * GET /api/email-metadata/case/:caseId
 * Get all emails linked to a case
 */
router.get("/api/email-metadata/case/:caseId", async (req, res) => {
    try {
        const { caseId } = req.params;

        const results = await db.select()
            .from(emailMetadata)
            .where(eq(emailMetadata.caseId, caseId));

        res.json(results);

    } catch (error) {
        console.error("Error fetching case emails:", error);
        res.status(500).json({ error: "Failed to fetch case emails" });
    }
});

/**
 * GET /api/email-metadata/order/:orderId
 * Get all emails linked to an order
 */
router.get("/api/email-metadata/order/:orderId", async (req, res) => {
    try {
        const { orderId } = req.params;

        const results = await db.select()
            .from(emailMetadata)
            .where(eq(emailMetadata.orderId, orderId));

        res.json(results);

    } catch (error) {
        console.error("Error fetching order emails:", error);
        res.status(500).json({ error: "Failed to fetch order emails" });
    }
});

/**
 * DELETE /api/email-metadata/:messageId
 * Delete email metadata (unlink from entities)
 */
router.delete("/api/email-metadata/:messageId", async (req, res) => {
    try {
        const { messageId } = req.params;

        await db.delete(emailMetadata)
            .where(eq(emailMetadata.messageId, messageId));

        res.json({ success: true });

    } catch (error) {
        console.error("Error deleting email metadata:", error);
        res.status(500).json({ error: "Failed to delete email metadata" });
    }
});

export default router;
