/**
 * Script to clear all email data from database for clean re-sync
 * This preserves email links to cases/orders but removes email content
 * so it can be re-fetched with proper threading
 * 
 * Run with: npx tsx server/scripts/clearEmailData.ts
 */

import 'dotenv/config';
import { db } from '../services/supabaseClient';
import { emailMessages, emailThreads, emailAttachments, emails, emailLinks } from '../../shared/schema';
import { sql } from 'drizzle-orm';

async function clearEmailData() {
    console.log('🗑️  Starting email data cleanup for re-sync...\n');

    try {
        // Get counts before deletion
        const messageCount = await db.select({ count: sql<number>`count(*)::int` }).from(emailMessages);
        const threadCount = await db.select({ count: sql<number>`count(*)::int` }).from(emailThreads);
        const attachmentCount = await db.select({ count: sql<number>`count(*)::int` }).from(emailAttachments);
        const emailsCount = await db.select({ count: sql<number>`count(*)::int` }).from(emails);

        console.log('📊 Current data:');
        console.log(`   - Emails (main table): ${emailsCount[0]?.count || 0}`);
        console.log(`   - Email messages: ${messageCount[0]?.count || 0}`);
        console.log(`   - Email threads: ${threadCount[0]?.count || 0}`);
        console.log(`   - Email attachments: ${attachmentCount[0]?.count || 0}`);
        console.log('');

        // Delete in correct order (foreign key constraints)
        console.log('🗑️  Deleting email links...');
        await db.delete(emailLinks);

        console.log('🗑️  Deleting email attachments...');
        await db.delete(emailAttachments);

        console.log('🗑️  Deleting email messages...');
        await db.delete(emailMessages);

        console.log('🗑️  Deleting email threads...');
        await db.delete(emailThreads);

        console.log('🗑️  Deleting emails (main table)...');
        await db.delete(emails);

        // Reset sync settings so next refresh does a full sync
        console.log('🔄  Resetting sync settings...');
        await db.execute(sql`DELETE FROM system_settings WHERE key IN ('mail_last_imap_uid', 'mail_initial_sync_done')`);

        console.log('\n✅ All email data cleared successfully!');
        console.log('\n📧 Next steps:');
        console.log('   1. Open the app at http://localhost:5000/mail');
        console.log('   2. Click "Vernieuwen" to start full email sync');
        console.log('   3. Wait for all emails to be fetched (this may take a few minutes)');
        console.log('   4. Emails will now be properly threaded using Message-ID headers');

    } catch (error) {
        console.error('❌ Error clearing email data:', error);
        process.exit(1);
    }

    process.exit(0);
}

clearEmailData();
