import { getUncachableOutlookClient } from '../outlookClient';
import type { EmailProvider, RawEmail } from './emailProvider';

export class OutlookProvider implements EmailProvider {
  async syncEmails(): Promise<RawEmail[]> {
    try {
      const client = await getUncachableOutlookClient();
      
      // Get recent emails
      const emails = await client
        .api('/me/messages')
        .top(50)
        .orderby('receivedDateTime desc')
        .get();

      return emails.value.map((email: any): RawEmail => ({
        messageId: email.id,
        conversationId: email.conversationId,
        subject: email.subject || '',
        from: email.sender?.emailAddress?.address || '',
        to: email.toRecipients?.[0]?.emailAddress?.address || '',
        body: email.body?.content || '',
        isHtml: email.body?.contentType === 'HTML',
        receivedDateTime: email.receivedDateTime,
        isRead: email.isRead || false,
        hasAttachment: email.hasAttachments || false,
        inReplyTo: email.internetMessageHeaders?.find((h: any) => h.name === 'In-Reply-To')?.value,
        references: email.internetMessageHeaders?.find((h: any) => h.name === 'References')?.value
      }));
    } catch (error) {
      console.error('Error syncing emails via Outlook:', error);
      throw error;
    }
  }

  async sendEmail(to: string, subject: string, body: string, replyToMessageId?: string): Promise<{ success: boolean }> {
    try {
      const client = await getUncachableOutlookClient();
      
      const message: any = {
        message: {
          subject: subject,
          body: {
            contentType: 'HTML',
            content: body
          },
          toRecipients: [
            {
              emailAddress: {
                address: to
              }
            }
          ]
        }
      };

      // Add reply headers if this is a reply
      if (replyToMessageId) {
        message.message.internetMessageHeaders = [
          { name: 'In-Reply-To', value: replyToMessageId },
          { name: 'References', value: replyToMessageId }
        ];
      }

      await client.api('/me/sendMail').post(message);
      
      return { success: true };
    } catch (error) {
      console.error('Error sending email via Outlook:', error);
      throw error;
    }
  }
}