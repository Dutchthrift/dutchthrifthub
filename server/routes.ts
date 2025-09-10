import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTodoSchema, insertRepairSchema, insertInternalNoteSchema } from "@shared/schema";
import { syncEmails, sendEmail } from "./outlookClient";
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

          // Create order
          await storage.createOrder({
            shopifyOrderId: shopifyOrder.id.toString(),
            orderNumber: shopifyOrder.order_number,
            customerId: customer?.id,
            customerEmail: shopifyOrder.email,
            totalAmount: Math.round(parseFloat(shopifyOrder.total_price) * 100),
            currency: shopifyOrder.currency,
            status: shopifyOrder.financial_status as any,
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
      
      // Process and store emails (simplified)
      for (const email of emails) {
        // Check if thread exists
        let thread = await storage.getEmailThread(email.conversationId);
        
        if (!thread) {
          // Create new thread
          thread = await storage.createEmailThread({
            threadId: email.conversationId,
            subject: email.subject,
            customerEmail: email.sender?.emailAddress?.address,
            status: 'open',
            isUnread: !email.isRead,
            lastActivity: new Date(email.receivedDateTime)
          });
        }

        // Create message
        await storage.createEmailMessage({
          messageId: email.id,
          threadId: thread.id,
          fromEmail: email.sender?.emailAddress?.address || '',
          toEmail: email.toRecipients?.[0]?.emailAddress?.address || '',
          subject: email.subject,
          body: email.body?.content,
          isHtml: email.body?.contentType === 'HTML',
          sentAt: new Date(email.receivedDateTime)
        });
      }
      
      res.json({ synced: emails.length });
    } catch (error) {
      console.error("Error syncing emails:", error);
      res.status(500).json({ message: "Failed to sync emails" });
    }
  });

  // Send email
  app.post("/api/emails/send", async (req, res) => {
    try {
      const { to, subject, body } = req.body;
      await sendEmail(to, subject, body);
      res.json({ success: true });
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
