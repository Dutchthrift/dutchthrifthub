import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log('🔍 Debugging IMAP Credentials\n');
console.log('='.repeat(60));

const imapHost = (process.env.IMAP_HOST || '').trim();
const imapPort = parseInt(process.env.IMAP_PORT || '993');
const imapUser = (process.env.IMAP_USER || '').trim();
const imapPass = (process.env.IMAP_PASS || '').trim();

console.log('IMAP_HOST:', imapHost);
console.log('IMAP_HOST length:', imapHost.length);
console.log('IMAP_HOST (raw):', JSON.stringify(imapHost));
console.log('');

console.log('IMAP_PORT:', imapPort);
console.log('');

console.log('IMAP_USER:', imapUser);
console.log('IMAP_USER length:', imapUser.length);
console.log('IMAP_USER (raw):', JSON.stringify(imapUser));
console.log('');

console.log('IMAP_PASS:', imapPass.substring(0, 3) + '***');
console.log('IMAP_PASS length:', imapPass.length);
console.log('IMAP_PASS (raw):', JSON.stringify(imapPass));
console.log('IMAP_PASS has special chars:', /[#@!$%^&*()]/.test(imapPass));
console.log('');

console.log('='.repeat(60));
console.log('\n✅ Credential check complete');
