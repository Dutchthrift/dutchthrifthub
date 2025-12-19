export interface AttachmentDescriptor {
  filename: string;
  contentType: string;
  size: number;
  partId: string;
  contentId?: string;
  isInline: boolean;
}

export interface RawEmail {
  messageId: string;
  uid: number;
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
  attachments?: AttachmentDescriptor[];
}

export interface EmailProvider {
  getMailboxes(): Promise<{ path: string; name: string; specialUse?: string }[]>;
  syncEmails(mailbox?: string): Promise<RawEmail[]>;
  sendEmail(to: string, subject: string, body: string, replyToMessageId?: string): Promise<{ success: boolean }>;
  fetchEmailBody(uid: number): Promise<{ body: string; isHtml: boolean }>;
  downloadAttachment(uid: number, partId: string): Promise<{ buffer: Buffer; contentType: string }>;
  getLatestUid(): Promise<number>;
  fetchEmails(range: string): Promise<RawEmail[]>;
}