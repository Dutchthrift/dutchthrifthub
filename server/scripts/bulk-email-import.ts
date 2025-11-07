#!/usr/bin/env tsx

/**
 * Bulk Email Import Script
 * 
 * This script downloads the last 500 emails from your IMAP server
 * and stores them in the database. Run this once to populate your
 * email database, then use the regular daily sync.
 * 
 * Usage: npm run import-emails
 */

import { ImapSmtpProvider } from '../services/imapSmtpProvider.js';
import { storage } from '../storage.js';
import type { RawEmail } from '../services/emailProvider.js';
import { OrderMatchingService } from '../services/orderMatchingService.js';

const BATCH_SIZE = 50; // Process 50 emails at a time
const TOTAL_EMAILS = 500; // Total emails to import

async function importEmails() {
  console.log('🚀 Starting bulk email import...');
  console.log(`📊 Will import last ${TOTAL_EMAILS} emails in batches of ${BATCH_SIZE}`);
  
  const provider = new ImapSmtpProvider();
  const orderMatchingService = new OrderMatchingService();
  
  let totalProcessed = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  
  // Calculate number of batches
  const numBatches = Math.ceil(TOTAL_EMAILS / BATCH_SIZE);
  
  for (let batchNum = 0; batchNum < numBatches; batchNum++) {
    console.log(`\n📦 Processing batch ${batchNum + 1}/${numBatches}`);
    
    try {
      // Fetch emails for this batch
      const emails = await provider.syncEmailsWithLimit(BATCH_SIZE, batchNum * BATCH_SIZE);
      console.log(`📬 Received ${emails.length} emails in this batch`);
      
      if (emails.length === 0) {
        console.log('✅ No more emails to process');
        break;
      }
      
      // Process each email
      for (const email of emails) {
        totalProcessed++;
        
        try {
          // Check if message already exists (deduplication)
          const existingMessage = await storage.getEmailMessage(email.messageId);
          if (existingMessage) {
            totalSkipped++;
            console.log(`⏭️  Skipped duplicate: ${email.subject} (${totalProcessed}/${TOTAL_EMAILS})`);
            continue;
          }
          
          // Check if thread exists by threadId
          const threadId = email.conversationId || email.messageId;
          let thread = await storage.getEmailThreadByThreadId(threadId);
          
          if (!thread) {
            // Create new thread with automatic order matching
            try {
              const matchedOrder = await orderMatchingService.getOrderForAutoLink(
                email.body || "",
                email.from || "",
                email.subject || "",
              );
              
              thread = await storage.createEmailThread({
                threadId: threadId,
                subject: email.subject,
                customerEmail: email.from,
                status: "open",
                isUnread: !email.isRead,
                lastActivity: new Date(email.receivedDateTime),
                hasAttachment: email.hasAttachment,
                orderId: matchedOrder?.id || null,
              });
              
              if (matchedOrder) {
                console.log(`  🎯 Linked to order ${matchedOrder.orderNumber}`);
              }
            } catch (error: any) {
              if (error.code === "23505") {
                thread = await storage.getEmailThreadByThreadId(threadId);
                if (!thread) throw error;
              } else {
                throw error;
              }
            }
          }
          
          // Create message
          await storage.createEmailMessage({
            messageId: email.messageId,
            threadId: thread!.id,
            fromEmail: email.from,
            toEmail: email.to,
            subject: email.subject,
            body: email.body,
            isHtml: email.isHtml,
            sentAt: new Date(email.receivedDateTime),
          });
          
          totalCreated++;
          console.log(`✅ Imported: ${email.subject} (${totalProcessed}/${TOTAL_EMAILS})`);
          
        } catch (error) {
          console.error(`❌ Error processing email ${email.messageId}:`, error);
        }
      }
      
      console.log(`\n📊 Batch ${batchNum + 1} complete: ${totalCreated} created, ${totalSkipped} skipped`);
      
      // Small delay between batches to avoid overwhelming the server
      if (batchNum < numBatches - 1) {
        console.log('⏳ Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error(`❌ Error in batch ${batchNum + 1}:`, error);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Created: ${totalCreated}`);
  console.log(`Skipped (duplicates): ${totalSkipped}`);
  console.log('='.repeat(60));
  
  process.exit(0);
}

// Run the import
importEmails().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
