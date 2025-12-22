/**
 * Import SENT .eml files from data/emails_send/ into the database
 * These are marked as outbound messages for proper threading display
 * 
 * Usage: npx tsx server/scripts/importSentEmails.ts
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { simpleParser } from 'mailparser';
import DOMPurify from 'isomorphic-dompurify';
import { db } from '../services/database.js';
import { emailThreads, emailMessages } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Configuration
const SENT_EMAILS_DIR = path.join(process.cwd(), 'data', 'emails_send');
const BATCH_SIZE = 20;
const START_DATE = new Date('2025-01-01');

// Build thread ID from email headers (Gmail-style threading)
function buildThreadId(messageId: string, inReplyTo: string | undefined, references: string | undefined): string {
    if (references && references.trim()) {
        const refList = references.split(/\s+/).filter(r => r.includes('@'));
        if (refList.length > 0) {
            return refList[0].replace(/[<>]/g, '');
        }
    }
    if (inReplyTo && inReplyTo.trim()) {
        return inReplyTo.replace(/[<>]/g, '');
    }
    return messageId.replace(/[<>]/g, '');
}

async function importSentEmails() {
    console.log('📤 SENT Email Import Script');
    console.log('============================\n');

    // Check if directory exists
    if (!fs.existsSync(SENT_EMAILS_DIR)) {
        console.error(`❌ Directory not found: ${SENT_EMAILS_DIR}`);
        console.log('\nPlease create data\\emails_send\\ and place your sent .eml files there.');
        process.exit(1);
    }

    // Get all .eml files
    const files = fs.readdirSync(SENT_EMAILS_DIR).filter(f => f.toLowerCase().endsWith('.eml'));
    console.log(`📁 Found ${files.length} sent .eml files\n`);

    if (files.length === 0) {
        console.log('No .eml files found.');
        process.exit(1);
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    let threadsUpdated = 0;
    let messagesCreated = 0;

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(files.length / BATCH_SIZE);

        console.log(`📦 Processing batch ${batchNum}/${totalBatches}`);

        for (const filename of batch) {
            try {
                const filepath = path.join(SENT_EMAILS_DIR, filename);
                const emlContent = fs.readFileSync(filepath);
                const parsed = await simpleParser(emlContent);

                // Skip emails before start date
                if (parsed.date && parsed.date < START_DATE) {
                    skipped++;
                    continue;
                }

                const messageId = parsed.messageId || `${filename}@sent`;

                // Check if already imported
                const existingMessage = await db.select().from(emailMessages).where(
                    eq(emailMessages.messageId, messageId)
                ).limit(1);

                if (existingMessage.length > 0) {
                    skipped++;
                    continue;
                }

                // Sanitize HTML
                const cleanHtml = DOMPurify.sanitize(parsed.html || '', {
                    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'img', 'div', 'span', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'blockquote'],
                    ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'style']
                });

                // Extract threading headers
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

                // For SENT emails: from is dutchthrift, to is the customer
                const fromEmail = parsed.from?.value?.[0]?.address || 'contact@dutchthrift.com';
                const toEmail = parsed.to?.value?.[0]?.address || '';

                // Thread-first architecture: no longer write to legacy 'emails' table
                // Only emailThreads and emailMessages are used

                // Gmail-style: Find existing thread by checking ALL related Message-IDs
                let thread = null;
                for (const refId of allRelatedIds) {
                    const [found] = await db.select().from(emailThreads).where(
                        eq(emailThreads.threadId, refId)
                    ).limit(1);
                    if (found) {
                        thread = found;
                        break;
                    }
                }

                if (!thread) {
                    // Create new thread (this shouldn't happen often for sent emails)
                    [thread] = await db.insert(emailThreads).values({
                        threadId: cleanMessageId,
                        subject: parsed.subject || '(No subject)',
                        customerEmail: toEmail, // For sent emails, customer is the recipient
                        status: 'open',
                        isUnread: false,
                        lastActivity: parsed.date || new Date(),
                        hasAttachment: (parsed.attachments?.length || 0) > 0,
                    }).returning();
                } else {
                    // Update thread's lastActivity if this email is newer
                    if (parsed.date && parsed.date > (thread.lastActivity || new Date(0))) {
                        await db.update(emailThreads)
                            .set({ lastActivity: parsed.date })
                            .where(eq(emailThreads.id, thread.id));
                    }
                    threadsUpdated++;
                }

                // Create email message - MARKED AS OUTBOUND
                await db.insert(emailMessages).values({
                    messageId: messageId,
                    threadId: thread.id,
                    fromEmail: fromEmail,
                    toEmail: toEmail,
                    subject: parsed.subject || '(No subject)',
                    body: cleanHtml || parsed.text || '',
                    isHtml: !!cleanHtml,
                    sentAt: parsed.date || new Date(),
                    isOutbound: true, // Mark as outbound (sent by DutchThrift)
                });
                messagesCreated++;

                imported++;

                if (imported % 50 === 0) {
                    console.log(`   ✅ Imported ${imported} sent emails...`);
                }

            } catch (error: any) {
                errors++;
                console.error(`   ❌ Error: ${filename}: ${error.message}`);
            }
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n============================');
    console.log('📊 Sent Email Import Complete!');
    console.log(`   ✅ Imported: ${imported} sent emails`);
    console.log(`   🔗 Threads updated: ${threadsUpdated}`);
    console.log(`   💬 Messages created: ${messagesCreated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('\nRefresh the mail page to see complete conversations!');

    process.exit(0);
}

importSentEmails().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
