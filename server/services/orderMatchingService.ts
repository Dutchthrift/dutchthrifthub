import type { Order } from "@shared/schema";
import type { IStorage } from "../storage";

export class OrderMatchingService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  static extractOrderNumber(text: string): string | null {
    if (!text) return null;
    const patterns = [
      /#(\d{3,6})\b/i,
      /\border\s*#?(\d{3,6})\b/i,
      /return\s+request\s*#?(\d{3,6})\b/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) return match[1];
    }
    return null;
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
        if (match[1]) {
          orderNumbers.add(match[1]);
        } else if (match[0] && match[0].match(/^\d+$/)) {
          orderNumbers.add(match[0]);
        }
      }
    }

    return Array.from(orderNumbers);
  }

  /**
   * Try to match an email to an order using multiple strategies
   */
  async matchOrders(emailContent: string, customerEmail: string, emailSubject?: string): Promise<{
    primaryMatch: Order | null;
    allMatches: Order[];
    matchMethod: 'order_number' | 'email_fallback' | 'none';
  }> {
    const combinedText = `${emailSubject || ''} ${emailContent}`;

    // Strategy 1: Find order numbers in content
    const potentialNumbers = this.extractOrderNumbers(combinedText);

    if (potentialNumbers.length > 0) {
      const matchedOrders: Order[] = [];

      for (const number of potentialNumbers) {
        const order = await this.storage.getOrderByOrderNumber(number);
        if (order) {
          matchedOrders.push(order);
        }
      }

      if (matchedOrders.length > 0) {
        // Sort matches by date (most recent first)
        const sortedMatches = matchedOrders.sort((a, b) => {
          const dateA = new Date(a.orderDate || a.createdAt || 0).getTime();
          const dateB = new Date(b.orderDate || b.createdAt || 0).getTime();
          return dateB - dateA;
        });

        return {
          primaryMatch: sortedMatches[0],
          allMatches: sortedMatches,
          matchMethod: 'order_number'
        };
      }
    }

    // Strategy 2: Fallback to customer email
    if (customerEmail) {
      const emailMatches = await this.storage.getOrdersByCustomerEmail(customerEmail);

      if (emailMatches.length > 0) {
        // Sort matches by date (most recent first)
        const sortedEmailMatches = emailMatches.sort((a, b) => {
          const dateA = new Date(a.orderDate || a.createdAt || 0).getTime();
          const dateB = new Date(b.orderDate || b.createdAt || 0).getTime();
          return dateB - dateA;
        });

        return {
          primaryMatch: sortedEmailMatches[0], // Most recent order
          allMatches: emailMatches,
          matchMethod: 'email_fallback'
        };
      }
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

import { storage } from "../storage";
export const orderMatchingService = new OrderMatchingService(storage);