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