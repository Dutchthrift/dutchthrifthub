import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTodoSchema, insertRepairSchema, insertInternalNoteSchema, insertPurchaseOrderSchema, insertCaseSchema } from "@shared/schema";
import { syncEmails, sendEmail } from "./services/emailService";
import { shopifyClient } from "./services/shopifyClient";

export async function registerRoutes(app: Express): Promise<Server> {
  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Todos
  app.get("/api/todos", async (req, res) => {
    try {
      const { userId, caseId } = req.query;
      
      if (caseId) {
        // Get todos linked to a specific case
        const relatedItems = await storage.getCaseRelatedItems(caseId as string);
        res.json(relatedItems.todos);
      } else {
        // Get todos for a user or all todos
        const todos = await storage.getTodos(userId as string);
        res.json(todos);
      }
    } catch (error) {
      console.error("Error fetching todos:", error);
      res.status(500).json({ message: "Failed to fetch todos" });
    }
  });

  app.post("/api/todos", async (req, res) => {
    try {
      const validatedData = insertTodoSchema.parse(req.body);
      
      // Convert dueDate string to Date object if provided
      if (validatedData.dueDate && typeof validatedData.dueDate === 'string') {
        validatedData.dueDate = new Date(validatedData.dueDate);
      }
      
      const todo = await storage.createTodo(validatedData);
      
      // Create activity
      await storage.createActivity({
        type: "todo_created",
        description: `Created todo: ${todo.title}`,
        userId: todo.assignedUserId,
        metadata: { todoId: todo.id }
      });

      res.status(201).json(todo);
    } catch (error) {
      console.error("Error creating todo:", error);
      res.status(400).json({ message: "Failed to create todo" });
    }
  });

  app.patch("/api/todos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Convert dueDate string to Date object if provided in update
      const updateData = { ...req.body };
      if (updateData.dueDate && typeof updateData.dueDate === 'string') {
        updateData.dueDate = new Date(updateData.dueDate);
      }
      if (updateData.completedAt && typeof updateData.completedAt === 'string') {
        updateData.completedAt = new Date(updateData.completedAt);
      }
      
      const todo = await storage.updateTodo(id, updateData);
      
      if (req.body.status === 'done') {
        await storage.createActivity({
          type: "todo_completed",
          description: `Completed todo: ${todo.title}`,
          userId: todo.assignedUserId,
          metadata: { todoId: todo.id }
        });
      }

      res.json(todo);
    } catch (error) {
      console.error("Error updating todo:", error);
      res.status(400).json({ message: "Failed to update todo" });
    }
  });

  app.delete("/api/todos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTodo(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting todo:", error);
      res.status(400).json({ message: "Failed to delete todo" });
    }
  });

  // Repairs
  app.get("/api/repairs", async (req, res) => {
    try {
      const { caseId } = req.query;
      
      if (caseId) {
        // Get repairs linked to a specific case
        const relatedItems = await storage.getCaseRelatedItems(caseId as string);
        res.json(relatedItems.repairs);
      } else {
        // Get all repairs
        const repairs = await storage.getRepairs();
        res.json(repairs);
      }
    } catch (error) {
      console.error("Error fetching repairs:", error);
      res.status(500).json({ message: "Failed to fetch repairs" });
    }
  });

  app.get("/api/repairs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const repair = await storage.getRepair(id);
      if (!repair) {
        return res.status(404).json({ message: "Repair not found" });
      }
      res.json(repair);
    } catch (error) {
      console.error("Error fetching repair:", error);
      res.status(500).json({ message: "Failed to fetch repair" });
    }
  });

  app.post("/api/repairs", async (req, res) => {
    try {
      const validatedData = insertRepairSchema.parse(req.body);
      const repair = await storage.createRepair(validatedData);
      
      await storage.createActivity({
        type: "repair_created",
        description: `Created repair: ${repair.title}`,
        userId: repair.assignedUserId,
        metadata: { repairId: repair.id }
      });

      res.status(201).json(repair);
    } catch (error) {
      console.error("Error creating repair:", error);
      res.status(400).json({ message: "Failed to create repair" });
    }
  });

  app.patch("/api/repairs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const repair = await storage.updateRepair(id, req.body);
      
      if (req.body.status) {
        await storage.createActivity({
          type: "repair_status_updated",
          description: `Updated repair status to ${req.body.status}: ${repair.title}`,
          userId: repair.assignedUserId,
          metadata: { repairId: repair.id, status: req.body.status }
        });
      }

      res.json(repair);
    } catch (error) {
      console.error("Error updating repair:", error);
      res.status(400).json({ message: "Failed to update repair" });
    }
  });

  // Create sample repairs for testing
  app.post("/api/repairs/create-samples", async (req, res) => {
    try {
      const sampleRepairs = [
        {
          title: "iPhone 12 Screen Replacement",
          description: "Customer dropped device, screen completely shattered. Screen replacement needed.",
          status: "new" as const,
          priority: "high" as const,
          estimatedCost: 15000, // €150.00
          partsNeeded: ["iPhone 12 Screen", "Screen Adhesive"],
          slaDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
        },
        {
          title: "MacBook Air M1 Battery Issue",
          description: "Battery not holding charge. Diagnostic required to determine replacement necessity.",
          status: "in_progress" as const,
          priority: "medium" as const,
          estimatedCost: 18000, // €180.00
          partsNeeded: ["MacBook Air M1 Battery"],
          slaDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
        },
        {
          title: "Samsung Galaxy S21 Water Damage",
          description: "Device exposed to water, not powering on. Full diagnostic and cleaning required.",
          status: "waiting_customer" as const,
          priority: "urgent" as const,
          estimatedCost: 25000, // €250.00
          partsNeeded: ["Cleaning Kit", "Possibly Motherboard"],
          slaDeadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) // 1 day from now
        },
        {
          title: "iPad Pro Charging Port Repair",
          description: "Charging port loose, device charges intermittently. Port replacement needed.",
          status: "ready" as const,
          priority: "medium" as const,
          estimatedCost: 8000, // €80.00
          partsNeeded: ["iPad Pro Charging Port"],
          slaDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
        },
        {
          title: "PS5 Controller Stick Drift",
          description: "Left analog stick drifting, affecting gaming experience. Stick module replacement.",
          status: "closed" as const,
          priority: "low" as const,
          estimatedCost: 3500, // €35.00
          actualCost: 3500,
          partsNeeded: ["PS5 Analog Stick Module"],
          completedAt: new Date()
        }
      ];

      let created = 0;
      const results = [];
      
      for (const repairData of sampleRepairs) {
        try {
          // Validate the data with the schema
          const validatedData = insertRepairSchema.parse(repairData);
          await storage.createRepair(validatedData);
          created++;
          results.push({ title: repairData.title, ok: true });
        } catch (error) {
          console.error(`Error creating repair "${repairData.title}":`, error);
          results.push({ 
            title: repairData.title, 
            ok: false, 
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      res.json({ created, results, message: `Created ${created} sample repairs` });
    } catch (error) {
      console.error("Error creating sample repairs:", error);
      res.status(500).json({ message: "Failed to create sample repairs" });
    }
  });

  // Orders
  app.get("/api/orders", async (req, res) => {
    try {
      const { caseId } = req.query;
      
      if (caseId) {
        // Get orders linked to a specific case
        const relatedItems = await storage.getCaseRelatedItems(caseId as string);
        res.json(relatedItems.orders);
      } else {
        // Get all orders with optional limit for dropdowns (default 20 for UI performance)
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
        const orders = await storage.getOrders(limit);
        res.json(orders);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // Test Shopify connection
  app.get("/api/shopify/test", async (req, res) => {
    try {
      // Try to get shop info first (lighter request)
      const response = await fetch(`${process.env.SHOPIFY_SHOP_DOMAIN ? 
        `https://${process.env.SHOPIFY_SHOP_DOMAIN.replace('.myshopify.com', '')}.myshopify.com` : 
        'https://shambu-nl.myshopify.com'
      }/admin/api/2024-01/shop.json`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_PASSWORD || ''
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({
          error: 'Shopify connection failed',
          status: response.status,
          message: errorText,
          credentials: {
            hasToken: !!(process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_PASSWORD),
            tokenLength: (process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_PASSWORD || '').length,
            shopDomain: process.env.SHOPIFY_SHOP_DOMAIN || 'shambu-nl.myshopify.com'
          }
        });
      }
      
      const shopInfo = await response.json();
      res.json({
        success: true,
        shop: shopInfo.shop?.name || 'Connected',
        domain: shopInfo.shop?.myshopify_domain,
        message: 'Shopify connection successful'
      });
    } catch (error) {
      console.error('Shopify test error:', error);
      res.status(500).json({
        error: 'Shopify test failed',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Sync customers from Shopify
  app.post("/api/customers/sync", async (req, res) => {
    try {
      const shopifyCustomers = await shopifyClient.getCustomers({ limit: 100 });
      
      let synced = 0;
      let created = 0;
      let updated = 0;
      
      for (const shopifyCustomer of shopifyCustomers) {
        if (!shopifyCustomer.email) continue; // Skip customers without email
        
        const existingCustomer = await storage.getCustomerByEmail(shopifyCustomer.email);
        
        if (!existingCustomer) {
          // Create new customer
          await storage.createCustomer({
            email: shopifyCustomer.email,
            firstName: shopifyCustomer.first_name || null,
            lastName: shopifyCustomer.last_name || null,
            phone: shopifyCustomer.phone || null,
            shopifyCustomerId: shopifyCustomer.id.toString()
          });
          created++;
        } else if (!existingCustomer.shopifyCustomerId || existingCustomer.shopifyCustomerId !== shopifyCustomer.id.toString()) {
          // Update existing customer with Shopify ID if missing
          await storage.updateCustomer(existingCustomer.id, {
            shopifyCustomerId: shopifyCustomer.id.toString(),
            phone: shopifyCustomer.phone || existingCustomer.phone
          });
          updated++;
        }
        synced++;
      }
      
      res.json({ 
        synced, 
        created, 
        updated,
        message: `Customer sync completed: ${created} created, ${updated} updated from ${synced} Shopify customers` 
      });
    } catch (error) {
      console.error("Error syncing customers from Shopify:", error);
      res.status(500).json({ message: "Failed to sync customers from Shopify", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Sync orders from Shopify
  app.post("/api/orders/sync", async (req, res) => {
    try {
      const shopifyOrders = await shopifyClient.getOrders({ limit: 50 });
      
      for (const shopifyOrder of shopifyOrders) {
        const existingOrder = await storage.getOrderByShopifyId(shopifyOrder.id.toString());
        
        if (!existingOrder) {
          // Create customer if doesn't exist
          let customer = null;
          if (shopifyOrder.customer && shopifyOrder.customer.email) {
            customer = await storage.getCustomerByEmail(shopifyOrder.customer.email);
            if (!customer) {
              customer = await storage.createCustomer({
                email: shopifyOrder.customer.email,
                firstName: shopifyOrder.customer.first_name,
                lastName: shopifyOrder.customer.last_name,
                shopifyCustomerId: shopifyOrder.customer.id.toString()
              });
            }
          }

          // Map Shopify financial status to our enum values
          const mapShopifyStatus = (financialStatus: string, fulfillmentStatus: string | null) => {
            if (fulfillmentStatus === 'fulfilled') return 'delivered';
            if (fulfillmentStatus === 'partial') return 'shipped';
            if (financialStatus === 'paid' || financialStatus === 'authorized') {
              return fulfillmentStatus === null ? 'processing' : 'shipped';
            }
            if (financialStatus === 'pending') return 'pending';
            if (financialStatus === 'refunded') return 'refunded';
            if (financialStatus === 'voided') return 'cancelled';
            return 'pending'; // default fallback
          };

          // Create order
          await storage.createOrder({
            shopifyOrderId: shopifyOrder.id.toString(),
            orderNumber: shopifyOrder.order_number,
            customerId: customer?.id,
            customerEmail: shopifyOrder.email,
            totalAmount: Math.round(parseFloat(shopifyOrder.total_price) * 100),
            currency: shopifyOrder.currency,
            status: mapShopifyStatus(shopifyOrder.financial_status, shopifyOrder.fulfillment_status),
            fulfillmentStatus: shopifyOrder.fulfillment_status,
            paymentStatus: shopifyOrder.financial_status,
            orderData: shopifyOrder
          });
        }
      }
      
      res.json({ 
        synced: shopifyOrders.length, 
        created: shopifyOrders.length, // All synced orders are new in this implementation
        message: `Order sync completed: ${shopifyOrders.length} orders synced from Shopify` 
      });
    } catch (error) {
      console.error("Error syncing orders:", error);
      res.status(500).json({ message: "Failed to sync orders" });
    }
  });

  // Create sample orders for testing (temporary until Shopify sync works)
  app.post("/api/orders/create-samples", async (req, res) => {
    try {
      const sampleOrders = [
        {
          shopifyOrderId: "5506048598246",
          orderNumber: "1001",
          customerEmail: "john.doe@example.com",
          totalAmount: 15999, // €159.99 
          currency: "EUR",
          status: "delivered" as const,
          fulfillmentStatus: "shipped",
          paymentStatus: "paid",
          orderData: {
            id: 5506048598246,
            created_at: "2024-09-10T10:30:00Z",
            line_items: [
              { title: "iPhone 12 Pro - 128GB", quantity: 1, price: "159.99" }
            ]
          }
        },
        {
          shopifyOrderId: "5506048598247",
          orderNumber: "1002", 
          customerEmail: "marie.smith@example.com",
          totalAmount: 8999, // €89.99
          currency: "EUR",
          status: "pending" as const,
          fulfillmentStatus: "pending",
          paymentStatus: "pending",
          orderData: {
            id: 5506048598247,
            created_at: "2024-09-10T14:15:00Z",
            line_items: [
              { title: "Samsung Galaxy S21 - 64GB", quantity: 1, price: "89.99" }
            ]
          }
        },
        {
          shopifyOrderId: "5506048598248", 
          orderNumber: "1003",
          customerEmail: "david.wilson@example.com",
          totalAmount: 25000, // €250.00
          currency: "EUR",
          status: "shipped" as const,
          fulfillmentStatus: "delivered",
          paymentStatus: "paid",
          orderData: {
            id: 5506048598248,
            created_at: "2024-09-09T09:00:00Z",
            line_items: [
              { title: "MacBook Air M1 - 256GB", quantity: 1, price: "250.00" }
            ]
          }
        }
      ];

      let created = 0;
      for (const orderData of sampleOrders) {
        const existingOrder = await storage.getOrderByShopifyId(orderData.shopifyOrderId);
        if (!existingOrder) {
          // Create customer if doesn't exist
          let customer = await storage.getCustomerByEmail(orderData.customerEmail);
          if (!customer) {
            const [firstName, lastName] = orderData.customerEmail.split('@')[0].split('.');
            customer = await storage.createCustomer({
              email: orderData.customerEmail,
              firstName: firstName?.charAt(0).toUpperCase() + firstName?.slice(1),
              lastName: lastName?.charAt(0).toUpperCase() + lastName?.slice(1),
              shopifyCustomerId: `customer_${orderData.shopifyOrderId}`
            });
          }

          await storage.createOrder({
            ...orderData,
            customerId: customer.id
          });
          created++;
        }
      }

      res.json({ created, message: `Created ${created} sample orders` });
    } catch (error) {
      console.error("Error creating sample orders:", error);
      res.status(500).json({ message: "Failed to create sample orders" });
    }
  });

  // Email threads
  app.get("/api/email-threads", async (req, res) => {
    try {
      const { caseId } = req.query;
      
      if (caseId) {
        // Get email threads linked to a specific case
        const relatedItems = await storage.getCaseRelatedItems(caseId as string);
        res.json(relatedItems.emails);
      } else {
        // Get all email threads
        const threads = await storage.getEmailThreads();
        res.json(threads);
      }
    } catch (error) {
      console.error("Error fetching email threads:", error);
      res.status(500).json({ message: "Failed to fetch email threads" });
    }
  });

  app.get("/api/email-threads/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const thread = await storage.getEmailThread(id);
      if (!thread) {
        return res.status(404).json({ message: "Email thread not found" });
      }
      
      const messages = await storage.getEmailMessages(id);
      res.json({ ...thread, messages });
    } catch (error) {
      console.error("Error fetching email thread:", error);
      res.status(500).json({ message: "Failed to fetch email thread" });
    }
  });

  // Sync emails
  app.post("/api/emails/sync", async (req, res) => {
    try {
      console.log(`🚀 Starting email sync...`);
      const emails = await syncEmails();
      console.log(`📬 Received ${emails.length} emails from IMAP provider`);
      
      // Process and store emails
      let processedCount = 0;
      for (const email of emails) {
        processedCount++;
        console.log(`📧 Processing email ${processedCount}/${emails.length}: ${email.messageId} (hasAttachment: ${email.hasAttachment})`);
        
        // Check if extractedAttachments exists and log details
        const extractedAttachments = (email as any).extractedAttachments;
        console.log(`🔍 Attachments check - Email ${email.messageId}: extractedAttachments type=${typeof extractedAttachments}, isArray=${Array.isArray(extractedAttachments)}, length=${extractedAttachments?.length || 'undefined'}`);
        if (extractedAttachments && Array.isArray(extractedAttachments) && extractedAttachments.length > 0) {
          console.log(`📎 Found ${extractedAttachments.length} attachments:`, extractedAttachments);
        }
        // Check if message already exists (deduplication)
        const existingMessage = await storage.getEmailMessage(email.messageId);
        if (existingMessage) {
          continue; // Skip if already processed
        }

        // Check if thread exists by threadId
        const threadId = email.conversationId || email.messageId;
        let thread = await storage.getEmailThreadByThreadId(threadId);
        
        if (!thread) {
          // Create new thread
          try {
            thread = await storage.createEmailThread({
              threadId: threadId,
              subject: email.subject,
              customerEmail: email.from,
              status: 'open',
              isUnread: !email.isRead,
              lastActivity: new Date(email.receivedDateTime),
              hasAttachment: email.hasAttachment
            });
          } catch (error: any) {
            // If duplicate thread ID, fetch the existing one
            if (error.code === '23505') {
              thread = await storage.getEmailThreadByThreadId(threadId);
              if (!thread) {
                throw error; // Re-throw if still can't find it
              }
            } else {
              throw error;
            }
          }
        }

        // Create message (only if not duplicate)
        try {
          const createdMessage = await storage.createEmailMessage({
            messageId: email.messageId,
            threadId: thread.id,
            fromEmail: email.from,
            toEmail: email.to,
            subject: email.subject,
            body: email.body,
            isHtml: email.isHtml,
            sentAt: new Date(email.receivedDateTime)
          });

          // Create attachment records if attachments were extracted
          const extractedAttachments = (email as any).extractedAttachments;
          console.log(`🔍 DEBUG: Email ${email.messageId} (hasAttachment: ${email.hasAttachment}) extractedAttachments:`, extractedAttachments);
          console.log(`🔍 DEBUG: Type check - extractedAttachments isArray: ${Array.isArray(extractedAttachments)}, length: ${extractedAttachments?.length || 'undefined'}`);
          
          if (extractedAttachments && Array.isArray(extractedAttachments) && extractedAttachments.length > 0) {
            console.log(`📎 Processing ${extractedAttachments.length} attachments for email ${email.messageId}`);
            for (let i = 0; i < extractedAttachments.length; i++) {
              const attachmentUrl = extractedAttachments[i];
              try {
                // Extract filename from storage URL
                const urlParts = attachmentUrl.split('/');
                const filename = urlParts[urlParts.length - 1];
                
                console.log(`📎 Creating attachment record ${i + 1}/${extractedAttachments.length}: ${filename} -> ${attachmentUrl}`);
                
                await storage.createEmailAttachment({
                  messageId: createdMessage.id,
                  filename: filename,
                  storageUrl: attachmentUrl,
                  contentType: 'application/octet-stream', // Default, could be improved
                  size: 0, // Could be improved to track actual size
                  isInline: false
                });
                
                console.log(`✅ Created attachment record: ${filename}`);
              } catch (attachmentError) {
                console.error(`❌ Error creating attachment record for ${attachmentUrl}:`, attachmentError);
              }
            }
          } else if (email.hasAttachment) {
            console.log(`⚠️ WARNING: Email ${email.messageId} has hasAttachment=true but extractedAttachments is empty or invalid`);
          }
        } catch (error: any) {
          // Skip duplicates, log others
          if (error.code !== '23505') {
            console.error('Error creating email message:', error);
          }
        }
      }
      
      res.json({ synced: emails.length });
    } catch (error) {
      console.error("Error syncing emails:", error);
      res.status(500).json({ message: "Failed to sync emails" });
    }
  });

  // Update email thread
  app.patch("/api/email-threads/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const thread = await storage.updateEmailThread(id, updateData);
      
      // Create activity for status changes
      if (updateData.status) {
        await storage.createActivity({
          type: "email_status_updated",
          description: `Email thread status changed to: ${updateData.status}`,
          userId: "default-user", // TODO: Use actual user from session
          metadata: { threadId: id, newStatus: updateData.status }
        });
      }
      
      res.json(thread);
    } catch (error) {
      console.error("Error updating email thread:", error);
      res.status(500).json({ message: "Failed to update email thread" });
    }
  });

  // Send email
  app.post("/api/emails/send", async (req, res) => {
    try {
      const { to, subject, body } = req.body;
      
      if (!to || !subject || !body) {
        return res.status(400).json({ message: "Missing required fields: to, subject, body" });
      }

      const result = await sendEmail(to, subject, body);
      res.json(result);
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  // Attachment endpoints
  app.get("/api/attachments/:attachmentPath(*)", async (req, res) => {
    try {
      const attachmentPath = '/' + req.params.attachmentPath;
      const attachment = await storage.getEmailAttachment(attachmentPath);
      if (!attachment) {
        return res.status(404).json({ error: 'Attachment not found' });
      }
      
      await storage.downloadAttachment(attachmentPath, res);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      res.status(500).json({ error: 'Failed to download attachment' });
    }
  });

  // Get attachments for an email message
  app.get("/api/emails/:messageId/attachments", async (req, res) => {
    try {
      const { messageId } = req.params;
      const attachments = await storage.getEmailMessageAttachments(messageId);
      res.json(attachments);
    } catch (error) {
      console.error('Error fetching attachments:', error);
      res.status(500).json({ error: 'Failed to fetch attachments' });
    }
  });

  // Activities
  app.get("/api/activities", async (req, res) => {
    try {
      const activities = await storage.getActivities();
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // Internal notes
  app.get("/api/notes/:entityType/:entityId", async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const notes = await storage.getInternalNotes(entityId, entityType);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post("/api/notes", async (req, res) => {
    try {
      const validatedData = insertInternalNoteSchema.parse(req.body);
      const note = await storage.createInternalNote(validatedData);
      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating note:", error);
      res.status(400).json({ message: "Failed to create note" });
    }
  });

  // Internal notes endpoint (alternate naming for frontend compatibility)
  app.get("/api/internal-notes", async (req, res) => {
    try {
      const { entityType, entityId, caseId } = req.query;
      
      if (caseId) {
        // Get notes linked to a specific case
        const relatedItems = await storage.getCaseRelatedItems(caseId as string);
        res.json(relatedItems.notes);
      } else if (entityType && entityId) {
        // Get notes for a specific entity  
        const notes = await storage.getInternalNotes(entityId as string, entityType as any);
        res.json(notes);
      } else {
        res.status(400).json({ message: "Either caseId or entityType+entityId required" });
      }
    } catch (error) {
      console.error("Error fetching internal notes:", error);
      res.status(500).json({ message: "Failed to fetch internal notes" });
    }
  });

  // Purchase Orders
  app.get("/api/purchase-orders", async (req, res) => {
    try {
      const purchaseOrders = await storage.getPurchaseOrders();
      res.json(purchaseOrders);
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      res.status(500).json({ message: "Failed to fetch purchase orders" });
    }
  });

  app.get("/api/purchase-orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const purchaseOrder = await storage.getPurchaseOrder(id);
      if (!purchaseOrder) {
        return res.status(404).json({ message: "Purchase order not found" });
      }
      res.json(purchaseOrder);
    } catch (error) {
      console.error("Error fetching purchase order:", error);
      res.status(500).json({ message: "Failed to fetch purchase order" });
    }
  });

  app.post("/api/purchase-orders", async (req, res) => {
    try {
      // Additional validation for photos array size
      if (req.body.photos && Array.isArray(req.body.photos)) {
        if (req.body.photos.length > 3) {
          return res.status(400).json({ message: "Maximum 3 images allowed" });
        }
        // Basic validation for base64 image format
        for (const photo of req.body.photos) {
          if (typeof photo !== 'string' || !photo.startsWith('data:image/')) {
            return res.status(400).json({ message: "Invalid image format" });
          }
          // Check approximate size (base64 is ~33% larger than original)
          if (photo.length > 2800000) { // ~2MB encoded size
            return res.status(400).json({ message: "Image too large, maximum 2MB per image" });
          }
        }
      }

      const validatedData = insertPurchaseOrderSchema.parse(req.body);
      
      // Convert purchaseDate string to Date object for database
      const purchaseOrderData = {
        ...validatedData,
        purchaseDate: typeof validatedData.purchaseDate === 'string' 
          ? new Date(validatedData.purchaseDate) 
          : validatedData.purchaseDate
      };
      
      const purchaseOrder = await storage.createPurchaseOrder(purchaseOrderData);
      
      // Create activity
      await storage.createActivity({
        type: "purchase_order_created",
        description: `Created purchase order: ${purchaseOrder.title}`,
        userId: null, // TODO: Get from session
        metadata: { purchaseOrderId: purchaseOrder.id }
      });

      res.status(201).json(purchaseOrder);
    } catch (error) {
      console.error("Error creating purchase order:", error);
      res.status(400).json({ message: "Failed to create purchase order" });
    }
  });

  app.patch("/api/purchase-orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Always validate with partial schema for data integrity
      const updateData = insertPurchaseOrderSchema.partial().parse(req.body);
      
      // Convert purchaseDate string to Date object for database if present
      const purchaseOrderUpdateData = updateData.purchaseDate 
        ? {
            ...updateData,
            purchaseDate: typeof updateData.purchaseDate === 'string' 
              ? new Date(updateData.purchaseDate) 
              : updateData.purchaseDate
          }
        : updateData;
      
      const purchaseOrder = await storage.updatePurchaseOrder(id, purchaseOrderUpdateData);
      
      if (req.body.status) {
        await storage.createActivity({
          type: "purchase_order_status_updated",
          description: `Updated purchase order status to ${req.body.status}: ${purchaseOrder.title}`,
          userId: null, // TODO: Get from session
          metadata: { purchaseOrderId: purchaseOrder.id, status: req.body.status }
        });
      }

      res.json(purchaseOrder);
    } catch (error) {
      console.error("Error updating purchase order:", error);
      res.status(400).json({ message: "Failed to update purchase order" });
    }
  });

  app.delete("/api/purchase-orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePurchaseOrder(id);
      
      await storage.createActivity({
        type: "purchase_order_deleted",
        description: `Deleted purchase order`,
        userId: null, // TODO: Get from session
        metadata: { purchaseOrderId: id }
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting purchase order:", error);
      res.status(400).json({ message: "Failed to delete purchase order" });
    }
  });

  // Search
  app.get("/api/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: "Search query is required" });
      }
      
      const results = await storage.globalSearch(q);
      res.json(results);
    } catch (error) {
      console.error("Error performing search:", error);
      res.status(500).json({ message: "Failed to perform search" });
    }
  });

  // Customers
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const customer = await storage.getCustomer(id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  app.get("/api/customers/:id/orders", async (req, res) => {
    try {
      const { id } = req.params;
      const orders = await storage.getCustomerOrders(id);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching customer orders:", error);
      res.status(500).json({ message: "Failed to fetch customer orders" });
    }
  });

  app.get("/api/customers/:id/email-threads", async (req, res) => {
    try {
      const { id } = req.params;
      const threads = await storage.getCustomerEmailThreads(id);
      res.json(threads);
    } catch (error) {
      console.error("Error fetching customer email threads:", error);
      res.status(500).json({ message: "Failed to fetch customer email threads" });
    }
  });

  app.get("/api/customers/:id/repairs", async (req, res) => {
    try {
      const { id } = req.params;
      const repairs = await storage.getCustomerRepairs(id);
      res.json(repairs);
    } catch (error) {
      console.error("Error fetching customer repairs:", error);
      res.status(500).json({ message: "Failed to fetch customer repairs" });
    }
  });

  // Cases
  app.get("/api/cases", async (req, res) => {
    try {
      const { status, q, emailThreadId } = req.query;
      const cases = await storage.getCases(status as string, q as string, emailThreadId as string);
      res.json(cases);
    } catch (error) {
      console.error("Error fetching cases:", error);
      res.status(500).json({ message: "Failed to fetch cases" });
    }
  });

  app.post("/api/cases", async (req, res) => {
    try {
      const validatedData = insertCaseSchema.parse(req.body);
      
      // Handle date conversions
      if (validatedData.slaDeadline && typeof validatedData.slaDeadline === 'string') {
        validatedData.slaDeadline = new Date(validatedData.slaDeadline);
      }
      if (validatedData.resolvedAt && typeof validatedData.resolvedAt === 'string') {
        validatedData.resolvedAt = new Date(validatedData.resolvedAt);
      }
      if (validatedData.closedAt && typeof validatedData.closedAt === 'string') {
        validatedData.closedAt = new Date(validatedData.closedAt);
      }
      
      const newCase = await storage.createCase(validatedData);
      
      // Create activity
      await storage.createActivity({
        type: "case_created",
        description: `Created case: ${newCase.title}`,
        userId: newCase.assignedUserId,
        metadata: { caseId: newCase.id, caseNumber: newCase.caseNumber }
      });

      res.status(201).json(newCase);
    } catch (error) {
      console.error("Error creating case:", error);
      res.status(400).json({ message: "Failed to create case" });
    }
  });

  app.get("/api/cases/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const caseItem = await storage.getCase(id);
      if (!caseItem) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Get related items
      const relatedItems = await storage.getCaseRelatedItems(id);
      
      res.json({
        case: caseItem,
        ...relatedItems
      });
    } catch (error) {
      console.error("Error fetching case:", error);
      res.status(500).json({ message: "Failed to fetch case" });
    }
  });

  app.patch("/api/cases/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Handle date conversions
      const updateData = { ...req.body };
      if (updateData.slaDeadline && typeof updateData.slaDeadline === 'string') {
        updateData.slaDeadline = new Date(updateData.slaDeadline);
      }
      if (updateData.resolvedAt && typeof updateData.resolvedAt === 'string') {
        updateData.resolvedAt = new Date(updateData.resolvedAt);
      }
      if (updateData.closedAt && typeof updateData.closedAt === 'string') {
        updateData.closedAt = new Date(updateData.closedAt);
      }
      
      const updatedCase = await storage.updateCase(id, updateData);
      
      // Create activity for status change
      if (req.body.status) {
        await storage.createActivity({
          type: "case_status_updated",
          description: `Updated case status to ${req.body.status}: ${updatedCase.title}`,
          userId: updatedCase.assignedUserId,
          metadata: { caseId: updatedCase.id, status: req.body.status }
        });
      }
      
      res.json(updatedCase);
    } catch (error) {
      console.error("Error updating case:", error);
      res.status(400).json({ message: "Failed to update case" });
    }
  });

  app.post("/api/cases/:id/link", async (req, res) => {
    try {
      const { id } = req.params;
      const { entityType, entityId } = req.body;
      
      if (!entityType || !entityId) {
        return res.status(400).json({ message: "entityType and entityId are required" });
      }
      
      if (!['email', 'repair', 'todo', 'order', 'note'].includes(entityType)) {
        return res.status(400).json({ message: "Invalid entityType" });
      }
      
      await storage.linkEntityToCase(id, entityType, entityId);
      
      const caseItem = await storage.getCase(id);
      await storage.createActivity({
        type: "case_entity_linked",
        description: `Linked ${entityType} to case: ${caseItem?.title}`,
        userId: caseItem?.assignedUserId,
        metadata: { caseId: id, entityType, entityId }
      });
      
      res.json({ message: "Entity linked to case successfully" });
    } catch (error) {
      console.error("Error linking entity to case:", error);
      res.status(400).json({ message: "Failed to link entity to case" });
    }
  });

  app.post("/api/cases/:id/unlink", async (req, res) => {
    try {
      const { entityType, entityId } = req.body;
      
      if (!entityType || !entityId) {
        return res.status(400).json({ message: "entityType and entityId are required" });
      }
      
      if (!['email', 'repair', 'todo', 'order', 'note'].includes(entityType)) {
        return res.status(400).json({ message: "Invalid entityType" });
      }
      
      await storage.unlinkEntityFromCase(entityType, entityId);
      
      const { id } = req.params;
      const caseItem = await storage.getCase(id);
      await storage.createActivity({
        type: "case_entity_unlinked",
        description: `Unlinked ${entityType} from case: ${caseItem?.title}`,
        userId: caseItem?.assignedUserId,
        metadata: { caseId: id, entityType, entityId }
      });
      
      res.json({ message: "Entity unlinked from case successfully" });
    } catch (error) {
      console.error("Error unlinking entity from case:", error);
      res.status(400).json({ message: "Failed to unlink entity from case" });
    }
  });

  app.post("/api/cases/from-email/:threadId", async (req, res) => {
    try {
      const { threadId } = req.params;
      
      const newCase = await storage.createCaseFromEmailThread(threadId);
      
      await storage.createActivity({
        type: "case_created_from_email",
        description: `Created case from email thread: ${newCase.title}`,
        userId: newCase.assignedUserId,
        metadata: { caseId: newCase.id, threadId }
      });
      
      res.status(201).json(newCase);
    } catch (error) {
      console.error("Error creating case from email thread:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create case from email thread" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
