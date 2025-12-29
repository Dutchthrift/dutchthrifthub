/**
 * Incremental Email Sync Service
 * 
 * Syncs only NEW emails (UID-based) from IMAP server.
 * Called by scheduled task every 5 minutes.
 */

import { ImapFlow } from 'imapflow';
import { storage } from '../storage';

// Folders to sync
const FOLDERS_TO_SYNC = [
    { path: 'INBOX', folderEnum: 'inbox' as const },
    { path: 'Sent Items', folderEnum: 'sent' as const },
];

function createImapClient() {
    return new ImapFlow({
        host: (process.env.IMAP_HOST || 'imap.strato.de').trim(),
        port: parseInt(process.env.IMAP_PORT || '993'),
        secure: true,
        auth: {
            user: (process.env.IMAP_USER || '').trim(),
            pass: (process.env.IMAP_PASS || '').trim(),
        },
        logger: false,
    });
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

async function getLastUidForFolder(folderEnum: string): Promise<number> {
    const lastUid = await storage.getSystemSetting(`imap_last_uid_${folderEnum}`);
    return lastUid ? parseInt(lastUid) : 0;
}

async function syncFolder(client: ImapFlow, folder: { path: string; folderEnum: 'inbox' | 'sent' }): Promise<number> {
    const lock = await client.getMailboxLock(folder.path);
    let synced = 0;

    try {
        // Get last UID we have in DB for this folder
        const lastUid = await getLastUidForFolder(folder.folderEnum);

        // Search for messages with UID > lastUid
        const searchQuery = lastUid > 0 ? { uid: `${lastUid + 1}:*` } : { all: true };
        const uids = await client.search(searchQuery, { uid: true });

        // Filter out the lastUid itself (IMAP range is inclusive)
        const newUids = Array.isArray(uids) ? uids.filter(uid => uid > lastUid) : [];

        if (newUids.length === 0) {
            return 0;
        }

        console.log(`📧 [Email Sync] Found ${newUids.length} new emails in ${folder.path}`);

        // Fetch new messages
        for await (const message of client.fetch(newUids, {
            envelope: true,
            flags: true,
            bodyStructure: true,
            internalDate: true,
            uid: true,
        }, { uid: true })) {
            try {
                const envelope = message.envelope;
                const uid = message.uid;

                // Check if already exists (safety check)
                const existing = await storage.getEmailByImapUid(uid, folder.folderEnum);

                if (existing) {
                    continue;
                }

                // Fetch body
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
                } catch {
                    // Body fetch failed, continue with empty body
                }

                // Insert into database
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

                // Update last UID in settings immediately to prevent re-sync if process crashes
                await storage.setSystemSetting(`imap_last_uid_${folder.folderEnum}`, uid.toString());

                synced++;
            } catch (msgError) {
                console.error(`❌ [Email Sync] Error processing message:`, msgError);
            }
        }

        return synced;
    } finally {
        lock.release();
    }
}

export async function incrementalEmailSync(): Promise<{ synced: number; errors: string[] }> {
    const errors: string[] = [];
    let totalSynced = 0;

    const client = createImapClient();

    try {
        await client.connect();

        for (const folder of FOLDERS_TO_SYNC) {
            try {
                const count = await syncFolder(client, folder);
                totalSynced += count;
            } catch (folderError) {
                const errorMsg = `Failed to sync ${folder.path}: ${folderError}`;
                console.error(`❌ [Email Sync] ${errorMsg}`);
                errors.push(errorMsg);
            }
        }

    } catch (error) {
        errors.push(`IMAP connection failed: ${error}`);
    } finally {
        try {
            await client.logout();
        } catch {
            // Ignore logout errors
        }
    }

    return { synced: totalSynced, errors };
}
