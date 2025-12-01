import type { EmailProvider } from './emailProvider';
import { ImapSmtpProvider } from './imapSmtpProvider';
import { OutlookProvider } from './outlookProvider';

// Factory function to get the appropriate email provider
export function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER || 'outlook';

  console.log(`Email provider configured as: ${provider}`);

  switch (provider.toLowerCase()) {
    case 'imap':
      return new ImapSmtpProvider();
    case 'outlook':
      return new OutlookProvider();
    default:
      console.warn(`Unknown email provider: ${provider}, defaulting to Outlook`);
      return new OutlookProvider();
  }
}

// Convenience functions
export async function syncEmails() {
  const provider = getEmailProvider();
  return provider.syncEmails();
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