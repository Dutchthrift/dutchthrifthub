
import { ImapFlow } from 'imapflow';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function checkImapConnection() {
    const config = {
        host: (process.env.IMAP_HOST || '').trim(),
        port: parseInt(process.env.IMAP_PORT || '993'),
        secure: true,
        auth: {
            user: (process.env.IMAP_USER || '').trim(),
            pass: (process.env.IMAP_PASS || '').trim()
        },
        logger: false
    };

    console.log('Testing IMAP Connection with config:', {
        host: config.host,
        port: config.port,
        user: config.auth.user,
        pass: '****'
    });

    const client = new ImapFlow(config);

    try {
        console.log('Connecting...');
        await client.connect();
        console.log('✅ Connection successful!');

        console.log('Opening INBOX...');
        const lock = await client.getMailboxLock('INBOX');
        try {
            console.log('✅ INBOX opened successfully.');
            console.log('Mailbox status:', client.mailbox);

            if (client.mailbox) {
                console.log(`Total messages: ${client.mailbox.exists}`);
                console.log(`Recent messages: ${client.mailbox.recent}`);
            }

        } finally {
            lock.release();
        }

        await client.logout();
        console.log('Logged out.');
        process.exit(0);

    } catch (error: any) {
        console.error('❌ IMAP Connection Failed:', error.message);
        if (error.response) {
            console.error('Server response:', error.response);
        }
        process.exit(1);
    }
}

checkImapConnection();
