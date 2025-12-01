import { ImapSmtpProvider } from '../server/services/imapSmtpProvider';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function fetchLatestEmails() {
    console.log('🔄 Starting email fetch from Strato server...\n');

    const provider = new ImapSmtpProvider();

    try {
        const emails = await provider.syncEmails();

        console.log('\n✅ Email fetch completed successfully!\n');
        console.log('='.repeat(60));
        console.log(`📧 Total emails fetched: ${emails.length}`);
        console.log('='.repeat(60));

        if (emails.length > 0) {
            console.log('\n📋 Email Summary:\n');

            emails.forEach((email, index) => {
                console.log(`${index + 1}. ${email.isRead ? '📖' : '📩'} ${email.subject || '(No Subject)'}`);
                console.log(`   From: ${email.from}`);
                console.log(`   To: ${email.to}`);
                console.log(`   Date: ${new Date(email.receivedDateTime).toLocaleString()}`);
                console.log(`   Has Attachments: ${email.hasAttachment ? '📎 Yes' : 'No'}`);
                console.log(`   Body Length: ${email.body.length} chars`);
                console.log(`   HTML: ${email.isHtml ? 'Yes' : 'No'}`);
                console.log('');
            });

            // Statistics
            const unreadCount = emails.filter(e => !e.isRead).length;
            const withAttachments = emails.filter(e => e.hasAttachment).length;
            const htmlEmails = emails.filter(e => e.isHtml).length;

            console.log('='.repeat(60));
            console.log('📊 Statistics:');
            console.log(`   Unread: ${unreadCount}`);
            console.log(`   With Attachments: ${withAttachments}`);
            console.log(`   HTML Format: ${htmlEmails}`);
            console.log(`   Plain Text: ${emails.length - htmlEmails}`);
            console.log('='.repeat(60));
        } else {
            console.log('\n⚠️ No emails found in the mailbox.');
        }

        process.exit(0);

    } catch (error: any) {
        console.error('\n❌ Error fetching emails:', error.message);
        if (error.stack) {
            console.error('\nStack trace:', error.stack);
        }
        process.exit(1);
    }
}

fetchLatestEmails();
