/**
 * Import Recent Emails Script
 * 
 * One-time import of the last 250 emails from INBOX and 250 from Sent Items
 * with full body content. Run this script once to populate the database.
 * 
 * Usage: npx tsx server/scripts/importRecentEmails.ts
 */

import 'dotenv/config';
import { ImapFlow } from 'imapflow';
import { storage } from '../storage';

// Configuration
const EMAILS_PER_FOLDER = 250;
const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES_MS = 1000;

interface FolderConfig {
    path: string;
    folderEnum: 'inbox' | 'sent';
}

const FOLDERS_TO_IMPORT: FolderConfig[] = [
    { path: 'INBOX', folderEnum: 'inbox' },
    { path: 'Sent Items', folderEnum: 'sent' },  // Strato uses "Sent Items" with \Sent flag
];

async function createImapClient() {
    const config = {
        host: (process.env.IMAP_HOST || 'imap.strato.de').trim(),
        port: parseInt(process.env.IMAP_PORT || '993'),
        secure: true,
        auth: {
            user: (process.env.IMAP_USER || '').trim(),
            pass: (process.env.IMAP_PASS || '').trim(),
        },
        logger: false as const,  // TypeScript needs 'as const' for literal false
    };

    if (!config.auth.user || !config.auth.pass) {
        throw new Error('IMAP_USER and IMAP_PASS must be set in environment');
    }

    return new ImapFlow(config);
}

function decodeContent(buffer: Buffer, encoding: string): string {
    try {
        switch (encoding?.toLowerCase()) {
            case 'base64':
                return Buffer.from(buffer.toString(), 'base64').toString('utf-8');
            case 'quoted-printable':
                return buffer.toString('utf-8')
                    .replace(/=\r?\n/g, '')
                    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
            case '7bit':
            case '8bit':
            case 'binary':
            default:
                return buffer.toString('utf-8');
        }
    } catch {
        return buffer.toString('utf-8');
    }
}

function findTextParts(structure: any, partId = ''): { partId: string; type: string; encoding: string }[] {
    const parts: { partId: string; type: string; encoding: string }[] = [];

    if (!structure) return parts;

    if (Array.isArray(structure)) {
        structure.forEach((part, index) => {
            const newPartId = partId ? `${partId}.${index + 1}` : `${index + 1}`;
            parts.push(...findTextParts(part, newPartId));
        });
    } else if (structure.type) {
        const mimeType = `${structure.type}/${structure.subtype || ''}`.toLowerCase();
        if (mimeType === 'text/plain' || mimeType === 'text/html') {
            parts.push({
                partId: partId || '1',
                type: mimeType,
                encoding: structure.encoding || '7bit',
            });
        }
        if (structure.childNodes) {
            structure.childNodes.forEach((child: any, idx: number) => {
                parts.push(...findTextParts(child, partId ? `${partId}.${idx + 1}` : `${idx + 1}`));
            });
        }
    }

    return parts;
}

async function importFolder(client: ImapFlow, folder: FolderConfig): Promise<number> {
    console.log(`\n📧 Importing from ${folder.path}...`);

    const lock = await client.getMailboxLock(folder.path);
    let imported = 0;

    try {
        const mailbox = client.mailbox;
        const totalMessages = mailbox && typeof mailbox === 'object' ? (mailbox as any).exists : 0;

        if (totalMessages === 0) {
            console.log(`   ⚠️ No messages in ${folder.path}`);
            return 0;
        }

        console.log(`   📊 Total messages: ${totalMessages}`);

        // Calculate range: get last EMAILS_PER_FOLDER messages
        const startSeq = Math.max(1, totalMessages - EMAILS_PER_FOLDER + 1);
        const endSeq = totalMessages;

        console.log(`   📥 Fetching messages ${startSeq} to ${endSeq} (${endSeq - startSeq + 1} emails)`);

        // Process in batches
        for (let batchStart = startSeq; batchStart <= endSeq; batchStart += BATCH_SIZE) {
            const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, endSeq);
            console.log(`   📦 Batch: ${batchStart}-${batchEnd}`);

            for await (const message of client.fetch(`${batchStart}:${batchEnd}`, {
                envelope: true,
                flags: true,
                bodyStructure: true,
                internalDate: true,
                uid: true,
            })) {
                try {
                    const envelope = message.envelope;
                    const uid = message.uid;

                    // Check if already exists
                    const existing = await storage.getEmailByImapUid(uid, folder.folderEnum);

                    // Check if existing email has placeholder content
                    const hasPlaceholder = existing && (
                        (existing.html && existing.html.includes('[Content will be loaded')) ||
                        (existing.text && existing.text.includes('[Content will be loaded')) ||
                        (!existing.html && !existing.text)
                    );

                    if (existing && !hasPlaceholder) {
                        continue; // Skip emails that already have real content
                    }

                    // Find and download body
                    let bodyText = '';
                    let isHtml = false;

                    try {
                        const textParts = findTextParts(message.bodyStructure);
                        const htmlPart = textParts.find(p => p.type === 'text/html');
                        const plainPart = textParts.find(p => p.type === 'text/plain');
                        const partToUse = htmlPart || plainPart;

                        if (partToUse) {
                            const { content: stream } = await client.download(uid.toString(), partToUse.partId, { uid: true });
                            const chunks: Buffer[] = [];
                            for await (const chunk of stream) {
                                chunks.push(chunk);
                            }
                            bodyText = decodeContent(Buffer.concat(chunks), partToUse.encoding);
                            isHtml = partToUse.type === 'text/html';
                        }
                    } catch (bodyError) {
                        console.log(`      ⚠️ Could not fetch body for UID ${uid}`);
                    }

                    if (existing && hasPlaceholder) {
                        // Update existing placeholder email with real content
                        await storage.updateEmail(existing.id, {
                            html: isHtml ? bodyText : null,
                            text: isHtml ? null : bodyText,
                        });
                        console.log(`      🔄 Updated placeholder email: ${envelope?.subject?.substring(0, 40)}...`);
                    } else {
                        // Insert new email
                        await storage.createEmail({
                            subject: envelope?.subject || '(No Subject)',
                            fromName: envelope?.from?.[0]?.name || envelope?.from?.[0]?.address?.split('@')[0] || 'Unknown',
                            fromEmail: envelope?.from?.[0]?.address || '',
                            html: isHtml ? bodyText : null,
                            text: isHtml ? null : bodyText,
                            date: message.internalDate instanceof Date ? message.internalDate : new Date(),
                            folder: folder.folderEnum,
                            imapUid: uid,
                        });
                    }

                    imported++;
                } catch (msgError) {
                    console.error(`      ❌ Error processing message:`, msgError);
                }
            }

            // Delay between batches
            if (batchEnd < endSeq) {
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
            }
        }

        console.log(`   ✅ Imported ${imported} emails from ${folder.path}`);
        return imported;

    } finally {
        lock.release();
    }
}

async function main() {
    console.log('🚀 Email Import Script');
    console.log('='.repeat(50));
    console.log(`📋 Will import last ${EMAILS_PER_FOLDER} emails from each folder`);
    console.log(`📂 Folders: ${FOLDERS_TO_IMPORT.map(f => f.path).join(', ')}`);
    console.log('='.repeat(50));

    const client = await createImapClient();

    try {
        console.log('\n🔌 Connecting to IMAP server...');
        await client.connect();
        console.log('✅ Connected successfully');

        let totalImported = 0;

        for (const folder of FOLDERS_TO_IMPORT) {
            try {
                const count = await importFolder(client, folder);
                totalImported += count;
            } catch (folderError) {
                console.error(`❌ Error importing ${folder.path}:`, folderError);
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log(`🎉 Import complete! Total imported: ${totalImported} emails`);
        console.log('='.repeat(50));

    } finally {
        await client.logout();
        console.log('\n🔌 Disconnected from IMAP server');
    }

    process.exit(0);
}

main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
