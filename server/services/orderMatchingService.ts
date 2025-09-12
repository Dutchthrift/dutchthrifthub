import type { Order } from "@shared/schema";
import type { IStorage } from "../storage";

export class OrderMatchingService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Extract potential order numbers from email content
   * Looks for patterns like: #8001, #8001, Order 8001, etc.
   */
  private extractOrderNumbers(text: string): string[] {
    if (!text) return [];

    // Patterns to match order numbers:
    // - #1234, #8001 (hash prefix)
    // - Order 1234, order 8001 (word prefix)
    // - Order #1234 (word + hash)
    // - DutchThrift Return Request #8001 (specific pattern from screenshot)
    const patterns = [
      /#(\d{3,6})\b/gi,                           // #8001, #1234
      /\border\s*#?(\d{3,6})\b/gi,                // Order 8001, Order #8001
      /return\s+request\s*#?(\d{3,6})\b/gi,       // Return Request #8001
      /\b(\d{4,6})\b(?=\s|$|[^\d])/g              // Standalone 4-6 digit numbers
    ];

    const orderNumbers = new Set<string>();

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const orderNumber = match[1];
        if (orderNumber && orderNumber.length >= 3) {
          orderNumbers.add(orderNumber);
        }
      }
    }

    return Array.from(orderNumbers);
  }

  /**
   * Try to match orders by order number patterns found in email content
   */
  private async matchByOrderNumber(text: string): Promise<Order[]> {
    const orderNumbers = this.extractOrderNumbers(text);
    const matchedOrders: Order[] = [];

    console.log(`🔍 Extracted potential order numbers from email: [${orderNumbers.join(', ')}]`);

    for (const orderNumber of orderNumbers) {
      try {
        // Try exact match first
        let order = await this.storage.getOrderByOrderNumber(orderNumber);
        
        if (!order) {
          // Try with leading zeros padding for shorter numbers
          const paddedOrderNumber = orderNumber.padStart(4, '0');
          order = await this.storage.getOrderByOrderNumber(paddedOrderNumber);
        }

        if (order) {
          console.log(`✅ Found order match by order number: ${orderNumber} -> Order ID: ${order.id}`);
          matchedOrders.push(order);
        } else {
          console.log(`❌ No order found for order number: ${orderNumber}`);
        }
      } catch (error) {
        console.error(`Error searching for order number ${orderNumber}:`, error);
      }
    }

    return matchedOrders;
  }

  /**
   * Try to match orders by customer email address
   */
  private async matchByEmail(customerEmail: string): Promise<Order[]> {
    if (!customerEmail) return [];

    try {
      const orders = await this.storage.getOrdersByCustomerEmail(customerEmail);
      console.log(`📧 Found ${orders.length} orders for email: ${customerEmail}`);
      return orders;
    } catch (error) {
      console.error(`Error searching orders by email ${customerEmail}:`, error);
      return [];
    }
  }

  /**
   * Main function to automatically match orders from email content
   * 1. First tries to match by order numbers found in email content
   * 2. Falls back to matching by customer email address
   * 3. Returns the most likely order match(es)
   */
  async matchOrders(emailContent: string, customerEmail: string, emailSubject?: string): Promise<{
    primaryMatch: Order | null;
    allMatches: Order[];
    matchMethod: 'order_number' | 'email_fallback' | 'none';
  }> {
    console.log(`\n🎯 Starting automatic order matching...`);
    console.log(`Email: ${customerEmail}`);
    console.log(`Subject: ${emailSubject || 'N/A'}`);
    
    // Combine subject and content for order number extraction
    const fullText = `${emailSubject || ''} ${emailContent || ''}`;

    // Step 1: Try matching by order number
    const orderNumberMatches = await this.matchByOrderNumber(fullText);
    if (orderNumberMatches.length > 0) {
      console.log(`✅ Order matching successful via order number: ${orderNumberMatches.length} match(es) found`);
      return {
        primaryMatch: orderNumberMatches[0], // Return the first/most relevant match
        allMatches: orderNumberMatches,
        matchMethod: 'order_number'
      };
    }

    // Step 2: Fallback to email matching
    console.log(`⚡ No order number matches found, falling back to email matching...`);
    const emailMatches = await this.matchByEmail(customerEmail);
    if (emailMatches.length > 0) {
      console.log(`✅ Order matching successful via email fallback: ${emailMatches.length} match(es) found`);
      
      // Sort by most recent order as primary match
      const sortedEmailMatches = emailMatches.sort((a, b) => 
        new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
      );
      
      return {
        primaryMatch: sortedEmailMatches[0], // Most recent order
        allMatches: emailMatches,
        matchMethod: 'email_fallback'
      };
    }

    console.log(`❌ No order matches found for email: ${customerEmail}`);
    return {
      primaryMatch: null,
      allMatches: [],
      matchMethod: 'none'
    };
  }

  /**
   * Utility function to get a simple match result for immediate linking
   */
  async getOrderForAutoLink(emailContent: string, customerEmail: string, emailSubject?: string): Promise<Order | null> {
    const result = await this.matchOrders(emailContent, customerEmail, emailSubject);
    return result.primaryMatch;
  }
}