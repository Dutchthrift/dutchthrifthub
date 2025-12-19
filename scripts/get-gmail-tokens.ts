import { google } from 'googleapis';
import readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';

if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
    console.error('❌ Fout: GMAIL_CLIENT_ID of GMAIL_CLIENT_SECRET ontbreekt in .env');
    process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI
);

const SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send'
];

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Forceert het geven van een refresh token
});

console.log('🚀 Autoriseer deze app door deze URL te bezoeken:');
console.log(authUrl);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.question('Kopieer de volledige redirect URL of alleen de "code=" waarde: ', async (input) => {
    try {
        let code = input;
        if (input.includes('code=')) {
            const url = new URL(input.startsWith('http') ? input : `http://localhost${input}`);
            code = url.searchParams.get('code') || input;
        }

        const { tokens } = await oauth2Client.getToken(code);
        console.log('\n✅ Succes! Hier zijn je tokens:');
        console.log(JSON.stringify(tokens, null, 2));
        console.log('\nKopieer de "refresh_token" naar je .env bestand als GMAIL_REFRESH_TOKEN');
    } catch (error: any) {
        console.error('❌ Fout bij het ophalen van tokens:', error.message);
    } finally {
        rl.close();
    }
});
