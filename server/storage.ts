import {
  type User, type InsertUser,
  type Customer, type InsertCustomer,
  type Order, type InsertOrder,
  type EmailThread, type InsertEmailThread,
  type EmailMessage, type InsertEmailMessage,
  type Repair, type InsertRepair,
  type Todo, type InsertTodo,
  type InternalNote, type InsertInternalNote,
  type PurchaseOrder, type InsertPurchaseOrder,
  type Activity, type InsertActivity,
  users, customers, orders, emailThreads, emailMessages, repairs, todos, internalNotes, purchaseOrders, activities
} from "@shared/schema";
import { db } from "./services/supabaseClient";
import { eq, desc, and, or, ilike, count } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Customers
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer>;

  // Orders
  getOrders(limit?: number): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderByShopifyId(shopifyId: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order>;

  // Email Threads
  getEmailThreads(limit?: number): Promise<EmailThread[]>;
  getEmailThread(id: string): Promise<EmailThread | undefined>;
  getEmailThreadByThreadId(threadId: string): Promise<EmailThread | undefined>;
  createEmailThread(thread: InsertEmailThread): Promise<EmailThread>;
  updateEmailThread(id: string, thread: Partial<InsertEmailThread>): Promise<EmailThread>;

  // Email Messages
  getEmailMessages(threadId: string): Promise<EmailMessage[]>;
  getEmailMessage(messageId: string): Promise<EmailMessage | undefined>;
  createEmailMessage(message: InsertEmailMessage): Promise<EmailMessage>;

  // Repairs
  getRepairs(): Promise<Repair[]>;
  getRepair(id: string): Promise<Repair | undefined>;
  createRepair(repair: InsertRepair): Promise<Repair>;
  updateRepair(id: string, repair: Partial<InsertRepair>): Promise<Repair>;
  getRepairsByStatus(status: string): Promise<Repair[]>;

  // Purchase Orders
  getPurchaseOrders(): Promise<PurchaseOrder[]>;
  getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined>;
  createPurchaseOrder(purchaseOrder: InsertPurchaseOrder): Promise<PurchaseOrder>;
  updatePurchaseOrder(id: string, purchaseOrder: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder>;
  deletePurchaseOrder(id: string): Promise<void>;

  // Todos
  getTodos(userId?: string): Promise<Todo[]>;
  getTodo(id: string): Promise<Todo | undefined>;
  createTodo(todo: InsertTodo): Promise<Todo>;
  updateTodo(id: string, todo: Partial<InsertTodo>): Promise<Todo>;
  deleteTodo(id: string): Promise<void>;

  // Internal Notes
  getInternalNotes(entityId: string, entityType: string): Promise<InternalNote[]>;
  createInternalNote(note: InsertInternalNote): Promise<InternalNote>;

  // Activities
  getActivities(limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  // Dashboard stats
  getDashboardStats(): Promise<{
    unreadEmails: number;
    newRepairs: number;
    slaAlerts: number;
    todaysOrders: { count: number; total: number };
  }>;

  // Search
  globalSearch(query: string): Promise<{
    customers: Customer[];
    orders: Order[];
    emailThreads: EmailThread[];
    repairs: Repair[];
  }>;
  
  // Customer relations
  getCustomers(): Promise<Customer[]>;
  getCustomerOrders(customerId: string): Promise<Order[]>;
  getCustomerEmailThreads(customerId: string): Promise<EmailThread[]>;
  getCustomerRepairs(customerId: string): Promise<Repair[]>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  // Customers
  async getCustomer(id: string): Promise<Customer | undefined> {
    const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    return result[0];
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const result = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
    return result[0];
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const result = await db.insert(customers).values(customer).returning();
    return result[0];
  }

  async updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer> {
    const result = await db.update(customers).set(customer).where(eq(customers.id, id)).returning();
    return result[0];
  }

  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getCustomerOrders(customerId: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.customerId, customerId)).orderBy(orders.orderNumber);
  }

  async getCustomerEmailThreads(customerId: string): Promise<EmailThread[]> {
    return await db.select().from(emailThreads).where(eq(emailThreads.customerId, customerId)).orderBy(desc(emailThreads.createdAt));
  }

  async getCustomerRepairs(customerId: string): Promise<Repair[]> {
    return await db.select().from(repairs).where(eq(repairs.customerId, customerId)).orderBy(desc(repairs.createdAt));
  }

  // Orders
  async getOrders(limit: number = 50): Promise<Order[]> {
    return await db.select().from(orders).orderBy(orders.orderNumber).limit(limit);
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return result[0];
  }

  async getOrderByShopifyId(shopifyId: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.shopifyOrderId, shopifyId)).limit(1);
    return result[0];
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const result = await db.insert(orders).values(order).returning();
    return result[0];
  }

  async updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order> {
    const result = await db.update(orders).set(order).where(eq(orders.id, id)).returning();
    return result[0];
  }

  // Email Threads
  async getEmailThreads(limit: number = 50): Promise<EmailThread[]> {
    return await db.select().from(emailThreads).orderBy(desc(emailThreads.lastActivity)).limit(limit);
  }

  async getEmailThread(id: string): Promise<EmailThread | undefined> {
    const result = await db.select().from(emailThreads).where(eq(emailThreads.id, id)).limit(1);
    return result[0];
  }

  async getEmailThreadByThreadId(threadId: string): Promise<EmailThread | undefined> {
    const result = await db.select().from(emailThreads).where(eq(emailThreads.threadId, threadId)).limit(1);
    return result[0];
  }

  async createEmailThread(thread: InsertEmailThread): Promise<EmailThread> {
    const result = await db.insert(emailThreads).values(thread).returning();
    return result[0];
  }

  async updateEmailThread(id: string, thread: Partial<InsertEmailThread>): Promise<EmailThread> {
    const result = await db.update(emailThreads).set(thread).where(eq(emailThreads.id, id)).returning();
    return result[0];
  }

  // Email Messages
  async getEmailMessages(threadId: string): Promise<EmailMessage[]> {
    return await db.select().from(emailMessages).where(eq(emailMessages.threadId, threadId)).orderBy(desc(emailMessages.sentAt));
  }

  async getEmailMessage(messageId: string): Promise<EmailMessage | undefined> {
    const result = await db.select().from(emailMessages).where(eq(emailMessages.messageId, messageId)).limit(1);
    return result[0];
  }

  async createEmailMessage(message: InsertEmailMessage): Promise<EmailMessage> {
    const result = await db.insert(emailMessages).values(message).returning();
    return result[0];
  }

  // Repairs
  async getRepairs(): Promise<Repair[]> {
    return await db.select().from(repairs).orderBy(desc(repairs.createdAt));
  }

  async getRepair(id: string): Promise<Repair | undefined> {
    const result = await db.select().from(repairs).where(eq(repairs.id, id)).limit(1);
    return result[0];
  }

  async createRepair(repair: InsertRepair): Promise<Repair> {
    const result = await db.insert(repairs).values(repair).returning();
    return result[0];
  }

  async updateRepair(id: string, repair: Partial<InsertRepair>): Promise<Repair> {
    const result = await db.update(repairs).set(repair).where(eq(repairs.id, id)).returning();
    return result[0];
  }

  async getRepairsByStatus(status: string): Promise<Repair[]> {
    return await db.select().from(repairs).where(eq(repairs.status, status as any));
  }

  // Todos
  async getTodos(userId?: string): Promise<Todo[]> {
    if (userId) {
      return await db.select().from(todos).where(eq(todos.assignedUserId, userId)).orderBy(desc(todos.createdAt));
    }
    return await db.select().from(todos).orderBy(desc(todos.createdAt));
  }

  async getTodo(id: string): Promise<Todo | undefined> {
    const result = await db.select().from(todos).where(eq(todos.id, id)).limit(1);
    return result[0];
  }

  async createTodo(todo: InsertTodo): Promise<Todo> {
    // Handle dueDate conversion for create
    const createData = { ...todo };
    if (createData.dueDate !== undefined && typeof createData.dueDate === 'string') {
      createData.dueDate = new Date(createData.dueDate);
    }
    const result = await db.insert(todos).values(createData as any).returning();
    return result[0];
  }

  async updateTodo(id: string, todo: Partial<InsertTodo>): Promise<Todo> {
    // Handle dueDate conversion
    const updateData = { ...todo };
    if (updateData.dueDate !== undefined) {
      if (typeof updateData.dueDate === 'string') {
        updateData.dueDate = new Date(updateData.dueDate);
      }
      // null and Date values can pass through as-is
    }
    const result = await db.update(todos).set(updateData as any).where(eq(todos.id, id)).returning();
    return result[0];
  }

  async deleteTodo(id: string): Promise<void> {
    await db.delete(todos).where(eq(todos.id, id));
  }

  // Internal Notes
  async getInternalNotes(entityId: string, entityType: string): Promise<InternalNote[]> {
    const column = entityType === 'customer' ? internalNotes.customerId :
                  entityType === 'order' ? internalNotes.orderId :
                  entityType === 'repair' ? internalNotes.repairId :
                  internalNotes.emailThreadId;
    
    return await db.select().from(internalNotes).where(eq(column, entityId)).orderBy(desc(internalNotes.createdAt));
  }

  async createInternalNote(note: InsertInternalNote): Promise<InternalNote> {
    const result = await db.insert(internalNotes).values(note).returning();
    return result[0];
  }

  // Activities
  async getActivities(limit: number = 20): Promise<Activity[]> {
    return await db.select().from(activities).orderBy(desc(activities.createdAt)).limit(limit);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const result = await db.insert(activities).values(activity).returning();
    return result[0];
  }

  // Dashboard stats
  async getDashboardStats() {
    const [unreadEmailsResult] = await db.select({ count: count() }).from(emailThreads).where(eq(emailThreads.isUnread, true));
    const [newRepairsResult] = await db.select({ count: count() }).from(repairs).where(eq(repairs.status, 'new'));
    const [slaAlertsResult] = await db.select({ count: count() }).from(emailThreads).where(and(
      eq(emailThreads.status, 'open'),
      // SLA alerts for threads older than 24 hours
    ));

    // Get today's orders - count and total amount
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // For now, get all orders and calculate totals (can be optimized later with date filtering)
    const allOrders = await db.select({
      totalAmount: orders.totalAmount,
      createdAt: orders.createdAt
    }).from(orders);

    // Filter orders created today and calculate totals
    const todaysOrders = allOrders.filter(order => {
      if (!order.createdAt) return false;
      const orderDate = new Date(order.createdAt);
      return orderDate >= today && orderDate < tomorrow;
    });


    const todaysOrdersResult = {
      count: todaysOrders.length,
      total: todaysOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0)
    };

    return {
      unreadEmails: unreadEmailsResult.count,
      newRepairs: newRepairsResult.count,
      slaAlerts: slaAlertsResult.count,
      todaysOrders: { 
        count: todaysOrdersResult.count || 0, 
        total: todaysOrdersResult.total || 0 
      }
    };
  }

  // Purchase Orders
  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    return await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt));
  }

  async getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined> {
    const result = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
    return result[0];
  }

  async createPurchaseOrder(purchaseOrder: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const result = await db.insert(purchaseOrders).values(purchaseOrder as any).returning();
    return result[0];
  }

  async updatePurchaseOrder(id: string, purchaseOrder: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder> {
    const result = await db.update(purchaseOrders).set(purchaseOrder as any).where(eq(purchaseOrders.id, id)).returning();
    return result[0];
  }

  async deletePurchaseOrder(id: string): Promise<void> {
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
  }

  // Search
  async globalSearch(query: string) {
    const searchTerm = `%${query}%`;

    const [foundCustomers, foundOrders, foundEmailThreads, foundRepairs, foundPurchaseOrders] = await Promise.all([
      db.select().from(customers).where(or(
        ilike(customers.email, searchTerm),
        ilike(customers.firstName, searchTerm),
        ilike(customers.lastName, searchTerm)
      )).limit(10),

      db.select().from(orders).where(or(
        ilike(orders.orderNumber, searchTerm),
        ilike(orders.customerEmail, searchTerm)
      )).limit(10),

      db.select().from(emailThreads).where(or(
        ilike(emailThreads.subject, searchTerm),
        ilike(emailThreads.customerEmail, searchTerm)
      )).limit(10),

      db.select().from(repairs).where(or(
        ilike(repairs.title, searchTerm),
        ilike(repairs.description, searchTerm)
      )).limit(10),

      db.select().from(purchaseOrders).where(or(
        ilike(purchaseOrders.title, searchTerm),
        ilike(purchaseOrders.supplierName, searchTerm),
        ilike(purchaseOrders.supplierNumber, searchTerm)
      )).limit(10)
    ]);

    return {
      customers: foundCustomers,
      orders: foundOrders,
      emailThreads: foundEmailThreads,
      repairs: foundRepairs,
      purchaseOrders: foundPurchaseOrders
    };
  }
}

export const storage = new DatabaseStorage();
