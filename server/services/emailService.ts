import type { EmailProvider } from './emailProvider';
import { ImapSmtpProvider } from './imapSmtpProvider';

// Factory function to get the email provider
// Note: Only IMAP/SMTP provider is supported (Outlook via Replit was removed)
export function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER || 'imap';

  console.log(`Email provider configured as: ${provider}`);

  switch (provider.toLowerCase()) {
    case 'imap':
    case 'smtp':
      return new ImapSmtpProvider();
    default:
      console.warn(`Unknown email provider: ${provider}, defaulting to IMAP`);
      return new ImapSmtpProvider();
  }
}

// Convenience functions
export async function getMailboxes() {
  const provider = getEmailProvider();
  return provider.getMailboxes();
}

export async function syncEmails(mailbox?: string) {
  const provider = getEmailProvider();
  return provider.syncEmails(mailbox);
}

export async function sendEmail(to: string, subject: string, body: string, replyToMessageId?: string) {
  const provider = getEmailProvider();
  return provider.sendEmail(to, subject, body, replyToMessageId);
}

export async function fetchEmailBody(uid: number) {
  const provider = getEmailProvider();
  if (!provider.fetchEmailBody) {
    throw new Error('Provider does not support fetching email body');
  }
  return provider.fetchEmailBody(uid);
}

export async function downloadAttachment(uid: number, partId: string) {
  const provider = getEmailProvider();
  if (!provider.downloadAttachment) {
    throw new Error('Provider does not support downloading attachments');
  }
  return provider.downloadAttachment(uid, partId);
}

export async function getLatestUid() {
  const provider = getEmailProvider();
  if (!provider.getLatestUid) {
    throw new Error('Provider does not support getting latest UID');
  }
  return provider.getLatestUid();
}

export async function fetchEmails(range: string) {
  const provider = getEmailProvider();
  if (!provider.fetchEmails) {
    throw new Error('Provider does not support fetching emails by range');
  }
  return provider.fetchEmails(range);
}