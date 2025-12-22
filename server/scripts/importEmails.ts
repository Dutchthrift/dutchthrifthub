/**
 * Import .eml files from a directory into the database with proper threading
 * 
 * Usage: npx tsx server/scripts/importEmails.ts
 * 
 * Expected directory: data/emails/ containing .eml files
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { simpleParser } from 'mailparser';
import DOMPurify from 'isomorphic-dompurify';
import { db } from '../services/database.js';
import { emailThreads, emailMessages, emailAttachments } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Configuration
const EMAILS_DIR = path.join(process.cwd(), 'data', 'emails');
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

async function importEmails() {
    console.log('📧 Email Import Script');
    console.log('=======================\n');

    // Check if directory exists
    if (!fs.existsSync(EMAILS_DIR)) {
        console.error(`❌ Directory not found: ${EMAILS_DIR}`);
        console.log('\nPlease create the directory and extract your .eml files there:');
        console.log(`  1. Create folder: data\\emails\\`);
        console.log(`  2. Extract your ZIP into that folder`);
        console.log(`  3. Run this script again`);
        process.exit(1);
    }

    // Get all .eml files
    const files = fs.readdirSync(EMAILS_DIR).filter(f => f.toLowerCase().endsWith('.eml'));
    console.log(`📁 Found ${files.length} .eml files in ${EMAILS_DIR}\n`);

    if (files.length === 0) {
        console.log('No .eml files found. Please check the directory.');
        process.exit(1);
    }

    // Stats
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    let threadsCreated = 0;
    let messagesCreated = 0;

    // Process files in batches
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(files.length / BATCH_SIZE);

        console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} files)`);

        for (const filename of batch) {
            try {
                const filepath = path.join(EMAILS_DIR, filename);
                const emlContent = fs.readFileSync(filepath);

                // Parse the .eml file
                const parsed = await simpleParser(emlContent);

                // Skip emails before start date
                if (parsed.date && parsed.date < START_DATE) {
                    skipped++;
                    continue;
                }

                // Generate a unique ID for this email based on message-id or filename
                const messageId = parsed.messageId || `${filename}@import`;

                // Check if already imported (by messageId in emailMessages table)
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
                    [thread] = await db.insert(emailThreads).values({
                        threadId: cleanMessageId,
                        subject: parsed.subject || '(No subject)',
                        customerEmail: parsed.from?.value?.[0]?.address || '',
                        status: 'open',
                        isUnread: false,
                        lastActivity: parsed.date || new Date(),
                        hasAttachment: (parsed.attachments?.length || 0) > 0,
                    }).returning();
                    threadsCreated++;
                } else {
                    // Update thread's lastActivity if this email is newer
                    if (parsed.date && parsed.date > (thread.lastActivity || new Date(0))) {
                        await db.update(emailThreads)
                            .set({ lastActivity: parsed.date })
                            .where(eq(emailThreads.id, thread.id));
                    }
                }

                // Create email message for threading
                await db.insert(emailMessages).values({
                    messageId: messageId,
                    threadId: thread.id,
                    fromEmail: parsed.from?.value?.[0]?.address || '',
                    toEmail: parsed.to?.value?.[0]?.address || '',
                    subject: parsed.subject || '(No subject)',
                    body: cleanHtml || parsed.text || '',
                    isHtml: !!cleanHtml,
                    sentAt: parsed.date || new Date(),
                });
                messagesCreated++;

                imported++;

                // Log progress
                if (imported % 50 === 0) {
                    console.log(`   ✅ Imported ${imported} emails...`);
                }

            } catch (error: any) {
                errors++;
                console.error(`   ❌ Error processing ${filename}: ${error.message}`);
            }
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n=======================');
    console.log('📊 Import Complete!');
    console.log(`   ✅ Imported: ${imported} emails`);
    console.log(`   📁 Threads created: ${threadsCreated}`);
    console.log(`   💬 Messages created: ${messagesCreated}`);
    console.log(`   ⏭️  Skipped: ${skipped} (duplicates or before Jan 1, 2025)`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('\nYou can now open the mail page to see your imported emails!');

    process.exit(0);
}

importEmails().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
