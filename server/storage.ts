import {
  type User, type InsertUser,
  type Customer, type InsertCustomer,
  type Order, type InsertOrder,
  type EmailThread, type InsertEmailThread,
  type EmailMessage, type InsertEmailMessage,
  type EmailAttachment, type InsertEmailAttachment,
  type Repair, type InsertRepair,
  type Todo, type InsertTodo,
  type InternalNote, type InsertInternalNote,
  type PurchaseOrder, type InsertPurchaseOrder,
  type Case, type InsertCase,
  type Activity, type InsertActivity,
  users, customers, orders, emailThreads, emailMessages, emailAttachments, repairs, todos, internalNotes, purchaseOrders, cases, activities
} from "@shared/schema";
import { db } from "./services/supabaseClient";
import { eq, desc, and, or, ilike, count, inArray, isNotNull, sql } from "drizzle-orm";
import { ObjectStorageService } from "./objectStorage";
import type { Response } from "express";

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
  getOrdersPaginated(page?: number, limit?: number): Promise<{ orders: Order[], total: number }>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderByShopifyId(shopifyId: string): Promise<Order | undefined>;
  getOrderByOrderNumber(orderNumber: string): Promise<Order | undefined>;
  getOrdersByCustomerEmail(customerEmail: string): Promise<Order[]>;
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

  // Email Attachments
  getEmailAttachment(attachmentPath: string): Promise<EmailAttachment | undefined>;
  getEmailMessageAttachments(messageId: string): Promise<EmailAttachment[]>;
  createEmailAttachment(attachment: InsertEmailAttachment): Promise<EmailAttachment>;
  downloadAttachment(attachmentPath: string, res: any): Promise<void>;

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

  // Cases
  getCases(status?: string, search?: string): Promise<Case[]>;
  getCase(id: string): Promise<Case | undefined>;
  createCase(caseData: InsertCase): Promise<Case>;
  updateCase(id: string, caseData: Partial<InsertCase>): Promise<Case>;
  deleteCase(id: string): Promise<void>;
  linkEntityToCase(caseId: string, entityType: 'email' | 'repair' | 'todo' | 'order' | 'note', entityId: string): Promise<void>;
  unlinkEntityFromCase(entityType: 'email' | 'repair' | 'todo' | 'order' | 'note', entityId: string): Promise<void>;
  createCaseFromEmailThread(threadId: string): Promise<Case>;
  getCaseRelatedItems(caseId: string): Promise<{
    emails: EmailThread[];
    orders: Order[];
    repairs: Repair[];
    todos: Todo[];
    notes: InternalNote[];
  }>;

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
    // Sort by order number descending (newest order number first)
    return await db.select().from(orders).orderBy(desc(orders.orderNumber)).limit(limit);
  }

  async getOrdersPaginated(page: number = 1, limit: number = 20, searchQuery?: string): Promise<{ orders: Order[], total: number }> {
    const offset = (page - 1) * limit;
    
    // Build search conditions
    let whereCondition;
    if (searchQuery) {
      const query = `%${searchQuery}%`;
      whereCondition = or(
        ilike(orders.orderNumber, query),
        ilike(orders.customerEmail, query)
      );
    }
    
    // Get total count with search filter
    const countQuery = db.select({ count: sql<number>`count(*)` }).from(orders);
    if (whereCondition) {
      countQuery.where(whereCondition);
    }
    const [countResult] = await countQuery;
    const total = Number(countResult.count);
    
    // Get paginated orders with search filter
    const ordersQuery = db
      .select()
      .from(orders)
      .orderBy(desc(orders.orderNumber))
      .limit(limit)
      .offset(offset);
    
    if (whereCondition) {
      ordersQuery.where(whereCondition);
    }
    
    const ordersResult = await ordersQuery;
    
    return {
      orders: ordersResult,
      total
    };
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return result[0];
  }

  async getOrderByShopifyId(shopifyId: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.shopifyOrderId, shopifyId)).limit(1);
    return result[0];
  }

  async getOrderByOrderNumber(orderNumber: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
    return result[0];
  }

  async getOrdersByCustomerEmail(customerEmail: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.customerEmail, customerEmail));
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
    // Convert empty strings to null for foreign key fields to avoid constraint violations
    const updateData = { ...thread };
    if (updateData.orderId === '') {
      updateData.orderId = null;
    }
    if (updateData.caseId === '') {
      updateData.caseId = null;
    }
    
    const result = await db.update(emailThreads).set(updateData).where(eq(emailThreads.id, id)).returning();
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

  // Cases
  async getCases(status?: string, search?: string, emailThreadId?: string): Promise<Case[]> {
    const conditions = [];
    
    if (status) {
      conditions.push(eq(cases.status, status as any));
    }
    
    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push(or(
        ilike(cases.title, searchTerm),
        ilike(cases.description, searchTerm),
        ilike(cases.caseNumber, searchTerm),
        ilike(cases.customerEmail, searchTerm)
      ));
    }
    
    if (emailThreadId) {
      // Find cases linked to this email thread via the emailThreads.caseId field
      const linkedThreads = await db.select({ caseId: emailThreads.caseId })
        .from(emailThreads)
        .where(and(
          eq(emailThreads.id, emailThreadId),
          isNotNull(emailThreads.caseId)
        ));
      
      const linkedCaseIds = linkedThreads
        .map(thread => thread.caseId)
        .filter(id => id !== null) as string[];
        
      if (linkedCaseIds.length > 0) {
        conditions.push(inArray(cases.id, linkedCaseIds));
      } else {
        // No linked cases found, return empty result
        return [];
      }
    }
    
    if (conditions.length > 0) {
      return await db.select().from(cases).where(and(...conditions)).orderBy(desc(cases.createdAt));
    } else {
      return await db.select().from(cases).orderBy(desc(cases.createdAt));
    }
  }

  async getCase(id: string): Promise<Case | undefined> {
    const result = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
    return result[0];
  }

  async createCase(caseData: InsertCase): Promise<Case> {
    // Generate a unique case number
    const existingCases = await db.select({ caseNumber: cases.caseNumber }).from(cases);
    const maxNumber = existingCases
      .map(c => parseInt(c.caseNumber.replace('CASE-', ''), 10))
      .filter(num => !isNaN(num))
      .reduce((max, num) => Math.max(max, num), 0);
    
    const newCaseNumber = `CASE-${String(maxNumber + 1).padStart(3, '0')}`;
    
    const createData = {
      ...caseData,
      caseNumber: newCaseNumber
    };

    // Handle date conversions
    if (createData.slaDeadline && typeof createData.slaDeadline === 'string') {
      createData.slaDeadline = new Date(createData.slaDeadline);
    }
    if (createData.resolvedAt && typeof createData.resolvedAt === 'string') {
      createData.resolvedAt = new Date(createData.resolvedAt);
    }
    if (createData.closedAt && typeof createData.closedAt === 'string') {
      createData.closedAt = new Date(createData.closedAt);
    }

    const result = await db.insert(cases).values(createData as any).returning();
    return result[0];
  }

  async updateCase(id: string, caseData: Partial<InsertCase>): Promise<Case> {
    // Handle date conversions
    const updateData = { ...caseData };
    if (updateData.slaDeadline && typeof updateData.slaDeadline === 'string') {
      updateData.slaDeadline = new Date(updateData.slaDeadline);
    }
    if (updateData.resolvedAt && typeof updateData.resolvedAt === 'string') {
      updateData.resolvedAt = new Date(updateData.resolvedAt);
    }
    if (updateData.closedAt && typeof updateData.closedAt === 'string') {
      updateData.closedAt = new Date(updateData.closedAt);
    }

    const result = await db.update(cases).set(updateData as any).where(eq(cases.id, id)).returning();
    return result[0];
  }

  async deleteCase(id: string): Promise<void> {
    // First unlink all related entities to avoid foreign key constraint violations
    
    // Unlink email threads
    await db.update(emailThreads).set({ caseId: null }).where(eq(emailThreads.caseId, id));
    
    // Unlink repairs
    await db.update(repairs).set({ caseId: null }).where(eq(repairs.caseId, id));
    
    // Unlink todos
    await db.update(todos).set({ caseId: null }).where(eq(todos.caseId, id));
    
    // Unlink internal notes
    await db.update(internalNotes).set({ caseId: null }).where(eq(internalNotes.caseId, id));
    
    // Now safe to delete the case
    await db.delete(cases).where(eq(cases.id, id));
  }

  async linkEntityToCase(caseId: string, entityType: 'email' | 'repair' | 'todo' | 'order' | 'note', entityId: string): Promise<void> {
    switch (entityType) {
      case 'email':
        await db.update(emailThreads).set({ caseId }).where(eq(emailThreads.id, entityId));
        break;
      case 'repair':
        await db.update(repairs).set({ caseId }).where(eq(repairs.id, entityId));
        break;
      case 'todo':
        await db.update(todos).set({ caseId }).where(eq(todos.id, entityId));
        break;
      case 'order':
        // For orders, we link via the email thread that might exist
        const orderEmailThread = await db.select().from(emailThreads).where(eq(emailThreads.orderId, entityId)).limit(1);
        if (orderEmailThread.length > 0) {
          await db.update(emailThreads).set({ caseId }).where(eq(emailThreads.orderId, entityId));
        }
        break;
      case 'note':
        await db.update(internalNotes).set({ caseId }).where(eq(internalNotes.id, entityId));
        break;
    }
  }

  async unlinkEntityFromCase(entityType: 'email' | 'repair' | 'todo' | 'order' | 'note', entityId: string): Promise<void> {
    switch (entityType) {
      case 'email':
        await db.update(emailThreads).set({ caseId: null }).where(eq(emailThreads.id, entityId));
        break;
      case 'repair':
        await db.update(repairs).set({ caseId: null }).where(eq(repairs.id, entityId));
        break;
      case 'todo':
        await db.update(todos).set({ caseId: null }).where(eq(todos.id, entityId));
        break;
      case 'order':
        await db.update(emailThreads).set({ caseId: null }).where(eq(emailThreads.orderId, entityId));
        break;
      case 'note':
        await db.update(internalNotes).set({ caseId: null }).where(eq(internalNotes.id, entityId));
        break;
    }
  }

  async createCaseFromEmailThread(threadId: string): Promise<Case> {
    const thread = await this.getEmailThread(threadId);
    if (!thread) {
      throw new Error('Email thread not found');
    }

    const caseData: InsertCase = {
      title: thread.subject || 'Case from email thread',
      description: `Case created from email thread: ${thread.subject}`,
      customerId: thread.customerId || undefined,
      customerEmail: thread.customerEmail || undefined,
      assignedUserId: thread.assignedUserId || undefined,
      priority: thread.priority || 'medium',
      status: 'new'
    };

    const newCase = await this.createCase(caseData);
    
    // Link the email thread to the case
    await this.linkEntityToCase(newCase.id, 'email', threadId);
    
    return newCase;
  }

  async getCaseRelatedItems(caseId: string): Promise<{
    emails: EmailThread[];
    orders: Order[];
    repairs: Repair[];
    todos: Todo[];
    notes: InternalNote[];
  }> {
    const [caseEmails, caseRepairs, caseTodos, caseNotes] = await Promise.all([
      db.select().from(emailThreads).where(eq(emailThreads.caseId, caseId)),
      db.select().from(repairs).where(eq(repairs.caseId, caseId)),
      db.select().from(todos).where(eq(todos.caseId, caseId)),
      db.select().from(internalNotes).where(eq(internalNotes.caseId, caseId))
    ]);

    // Get orders that are linked via email threads
    const orderIds = caseEmails.filter(email => email.orderId).map(email => email.orderId!);
    const caseOrders: Order[] = orderIds.length > 0 ? 
      await db.select().from(orders).where(or(
        ...orderIds.map(orderId => eq(orders.id, orderId))
      )) : [];

    return {
      emails: caseEmails,
      orders: caseOrders,
      repairs: caseRepairs,
      todos: caseTodos,
      notes: caseNotes
    };
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

  // Email Attachments
  async getEmailAttachment(attachmentPath: string): Promise<EmailAttachment | undefined> {
    const result = await db.select().from(emailAttachments).where(eq(emailAttachments.storageUrl, attachmentPath)).limit(1);
    return result[0];
  }

  async getEmailMessageAttachments(messageId: string): Promise<EmailAttachment[]> {
    return await db.select().from(emailAttachments).where(eq(emailAttachments.messageId, messageId));
  }

  async createEmailAttachment(attachment: InsertEmailAttachment): Promise<EmailAttachment> {
    const result = await db.insert(emailAttachments).values(attachment).returning();
    return result[0];
  }

  async downloadAttachment(attachmentPath: string, res: Response): Promise<void> {
    const objectStorageService = new ObjectStorageService();
    const file = await objectStorageService.getAttachmentFile(attachmentPath);
    await objectStorageService.downloadObject(file, res);
  }
}

export const storage = new DatabaseStorage();
