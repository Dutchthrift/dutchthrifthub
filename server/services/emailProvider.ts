export interface RawEmail {
  messageId: string;
  conversationId?: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  isHtml: boolean;
  receivedDateTime: string;
  isRead: boolean;
  hasAttachment: boolean;
  inReplyTo?: string;
  references?: string;
}

export interface EmailProvider {
  syncEmails(): Promise<RawEmail[]>;
  sendEmail(to: string, subject: string, body: string, replyToMessageId?: string): Promise<{ success: boolean }>;
}