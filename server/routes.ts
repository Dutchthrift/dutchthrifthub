import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTodoSchema, insertRepairSchema, insertInternalNoteSchema } from "@shared/schema";
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
      const { userId } = req.query;
      const todos = await storage.getTodos(userId as string);
      res.json(todos);
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
      const repairs = await storage.getRepairs();
      res.json(repairs);
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
      const orders = await storage.getOrders();
      res.json(orders);
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
      
      res.json({ synced: shopifyOrders.length });
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
      const threads = await storage.getEmailThreads();
      res.json(threads);
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
      const emails = await syncEmails();
      
      // Process and store emails
      for (const email of emails) {
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
          await storage.createEmailMessage({
            messageId: email.messageId,
            threadId: thread.id,
            fromEmail: email.from,
            toEmail: email.to,
            subject: email.subject,
            body: email.body,
            isHtml: email.isHtml,
            sentAt: new Date(email.receivedDateTime)
          });
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
      // Implementation would depend on how you want to list customers
      res.json([]);
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

  const httpServer = createServer(app);
  return httpServer;
}
