import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    console.error('❌ Fout: GMAIL_CLIENT_ID, CLIENT_SECRET of REFRESH_TOKEN ontbreekt in .env');
    process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    'http://localhost:5000/api/auth/google/callback'
);

oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

async function testGmailAccess() {
    try {
        console.log('🔍 Bezig met het ophalen van de laatste 5 threads...');
        const res = await gmail.users.threads.list({
            userId: 'me',
            maxResults: 5,
            q: 'in:inbox'
        });

        const threads = res.data.threads;
        if (!threads || threads.length === 0) {
            console.log('✅ Verbinding geslaagd, maar geen threads gevonden in de inbox.');
            return;
        }

        console.log(`✅ Succes! ${threads.length} threads gevonden:`);
        for (const thread of threads) {
            console.log(`- Thread ID: ${thread.id} | Snippet: ${thread.snippet}`);
        }
    } catch (error) {
        console.error('❌ Fout bij het testen van Gmail API:', error.message);
    }
}

testGmailAccess();
