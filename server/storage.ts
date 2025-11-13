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
  type Supplier, type InsertSupplier,
  type PurchaseOrderItem, type InsertPurchaseOrderItem,
  type PurchaseOrderFile, type InsertPurchaseOrderFile,
  type Return, type InsertReturn,
  type ReturnItem, type InsertReturnItem,
  type Case, type InsertCase,
  type CaseItem, type InsertCaseItem,
  type CaseLink, type InsertCaseLink,
  type CaseNote, type InsertCaseNote,
  type CaseEvent, type InsertCaseEvent,
  type Activity, type InsertActivity,
  type AuditLog, type InsertAuditLog,
  type Note, type InsertNote,
  type NoteTag, type InsertNoteTag,
  type NoteTagAssignment, type InsertNoteTagAssignment,
  type NoteMention, type InsertNoteMention,
  type NoteReaction, type InsertNoteReaction,
  type NoteAttachment, type InsertNoteAttachment,
  type NoteFollowup, type InsertNoteFollowup,
  type NoteRevision, type InsertNoteRevision,
  type NoteTemplate, type InsertNoteTemplate,
  type NoteLink, type InsertNoteLink,
  users, customers, orders, emailThreads, emailMessages, emailAttachments, repairs, todos, internalNotes, purchaseOrders, suppliers, purchaseOrderItems, purchaseOrderFiles, returns, returnItems, cases, caseItems, caseLinks, caseNotes, caseEvents, activities, auditLogs, systemSettings, notes, noteTags, noteTagAssignments, noteMentions, noteReactions, noteAttachments, noteFollowups, noteRevisions, noteTemplates, noteLinks
} from "@shared/schema";
import { db } from "./services/supabaseClient";
import { eq, desc, and, or, ilike, count, inArray, isNotNull, sql, getTableColumns } from "drizzle-orm";
import { ObjectStorageService } from "./objectStorage";
import type { Response } from "express";

export interface IStorage {
  // Users
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;

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
  getEmailThreads(filters?: {
    limit?: number;
    folder?: string;
    starred?: boolean;
    archived?: boolean;
    isUnread?: boolean;
    hasOrder?: boolean;
  }): Promise<EmailThread[]>;
  getEmailThread(id: string): Promise<EmailThread | undefined>;
  getEmailThreadByThreadId(threadId: string): Promise<EmailThread | undefined>;
  createEmailThread(thread: InsertEmailThread): Promise<EmailThread>;
  updateEmailThread(id: string, thread: Partial<InsertEmailThread>): Promise<EmailThread>;
  deleteEmailThread(id: string): Promise<void>;

  // Email Messages
  getEmailMessages(threadId: string): Promise<EmailMessage[]>;
  getEmailMessage(messageId: string): Promise<EmailMessage | undefined>;
  createEmailMessage(message: InsertEmailMessage): Promise<EmailMessage>;

  // Email Attachments
  getEmailAttachment(attachmentPath: string): Promise<EmailAttachment | undefined>;
  getEmailMessageAttachments(messageId: string): Promise<EmailAttachment[]>;
  createEmailAttachment(attachment: InsertEmailAttachment): Promise<EmailAttachment>;
  downloadAttachment(attachmentPath: string, res: any, forceDownload?: boolean): Promise<void>;

  // Repairs
  getRepairs(): Promise<Repair[]>;
  getRepair(id: string): Promise<Repair | undefined>;
  createRepair(repair: InsertRepair): Promise<Repair>;
  updateRepair(id: string, repair: Partial<InsertRepair>): Promise<Repair>;
  deleteRepair(id: string): Promise<void>;
  getRepairsByStatus(status: string): Promise<Repair[]>;
  getRepairsByTechnician(technicianId: string): Promise<Repair[]>;
  getRepairsByDateRange(startDate: Date, endDate: Date): Promise<Repair[]>;
  getRepairsWithFilters(filters: {
    status?: string;
    technicianId?: string;
    startDate?: Date;
    endDate?: Date;
    priority?: string;
  }): Promise<Repair[]>;

  // Suppliers
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  getSupplierByCode(code: string): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, supplier: Partial<InsertSupplier>): Promise<Supplier>;
  deleteSupplier(id: string): Promise<void>;
  importSuppliers(suppliers: InsertSupplier[]): Promise<void>;

  // Purchase Orders
  getPurchaseOrders(): Promise<PurchaseOrder[]>;
  getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined>;
  createPurchaseOrder(purchaseOrder: InsertPurchaseOrder): Promise<PurchaseOrder>;
  createPurchaseOrderWithItems(purchaseOrder: InsertPurchaseOrder, items: Omit<InsertPurchaseOrderItem, 'purchaseOrderId'>[]): Promise<PurchaseOrder>;
  updatePurchaseOrder(id: string, purchaseOrder: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder>;
  deletePurchaseOrder(id: string): Promise<void>;
  generatePONumber(): Promise<string>;

  // Purchase Order Items
  getPurchaseOrderItems(purchaseOrderId: string): Promise<PurchaseOrderItem[]>;
  createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem>;
  updatePurchaseOrderItem(id: string, item: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem>;
  deletePurchaseOrderItem(id: string): Promise<void>;

  // Purchase Order Files
  getPurchaseOrderFiles(purchaseOrderId: string): Promise<PurchaseOrderFile[]>;
  getPurchaseOrderFile(id: string): Promise<PurchaseOrderFile | undefined>;
  createPurchaseOrderFile(file: InsertPurchaseOrderFile): Promise<PurchaseOrderFile>;
  deletePurchaseOrderFile(id: string): Promise<void>;

  // Returns
  getReturns(filters?: { status?: string; customerId?: string; orderId?: string; assignedUserId?: string }): Promise<Return[]>;
  getReturn(id: string): Promise<Return | undefined>;
  getReturnByReturnNumber(returnNumber: string): Promise<Return | undefined>;
  createReturn(returnData: InsertReturn): Promise<Return>;
  createReturnWithItems(returnData: InsertReturn, items: Omit<InsertReturnItem, 'returnId'>[]): Promise<Return>;
  updateReturn(id: string, returnData: Partial<InsertReturn>): Promise<Return>;
  deleteReturn(id: string): Promise<void>;
  generateReturnNumber(): Promise<string>;
  getReturnsByStatus(status: string): Promise<Return[]>;
  getReturnsByCustomer(customerId: string): Promise<Return[]>;
  createReturnFromCase(caseId: string): Promise<Return>;

  // Return Items
  getReturnItems(returnId: string): Promise<ReturnItem[]>;
  createReturnItem(item: InsertReturnItem): Promise<ReturnItem>;
  updateReturnItem(id: string, item: Partial<InsertReturnItem>): Promise<ReturnItem>;
  deleteReturnItem(id: string): Promise<void>;

  // Todos
  getTodos(userId?: string): Promise<Todo[]>;
  getTodo(id: string): Promise<Todo | undefined>;
  createTodo(todo: InsertTodo): Promise<Todo>;
  updateTodo(id: string, todo: Partial<InsertTodo>): Promise<Todo>;
  deleteTodo(id: string): Promise<void>;

  // Internal Notes
  getInternalNotes(entityId: string, entityType: string): Promise<InternalNote[]>;
  createInternalNote(note: InsertInternalNote): Promise<InternalNote>;
  deleteInternalNote(noteId: string): Promise<void>;

  // Cases
  getCases(status?: string, search?: string): Promise<Case[]>;
  getCase(id: string): Promise<Case | undefined>;
  createCase(caseData: InsertCase): Promise<Case>;
  createCaseWithItems(caseData: InsertCase, items: Omit<InsertCaseItem, 'caseId'>[]): Promise<Case>;
  updateCase(id: string, caseData: Partial<InsertCase>): Promise<Case>;
  deleteCase(id: string): Promise<void>;
  getCaseItems(caseId: string): Promise<CaseItem[]>;
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

  // Case Links
  getCaseLinks(caseId: string): Promise<CaseLink[]>;
  createCaseLink(link: InsertCaseLink): Promise<CaseLink>;
  deleteCaseLink(linkId: string): Promise<void>;

  // Case Notes
  getCaseNotes(caseId: string): Promise<CaseNote[]>;
  createCaseNote(note: InsertCaseNote): Promise<CaseNote>;

  // Case Events
  getCaseEvents(caseId: string): Promise<CaseEvent[]>;
  createCaseEvent(event: InsertCaseEvent): Promise<CaseEvent>;

  // Activities
  getActivities(limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: string, activity: Partial<InsertActivity>): Promise<Activity>;
  deleteActivity(id: string): Promise<void>;

  // Audit Logs
  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(limit?: number): Promise<AuditLog[]>;

  // System Settings
  getSystemSetting(key: string): Promise<string | undefined>;
  setSystemSetting(key: string, value: string): Promise<void>;

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

  // Notes (Universal)
  getNotes(entityType: string, entityId: string, filters?: { visibility?: string; tagIds?: string[]; authorId?: string; }): Promise<Note[]>;
  getNote(id: string): Promise<Note | undefined>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: string, updates: Partial<InsertNote>): Promise<Note>;
  deleteNote(id: string, reason: string, userId: string): Promise<void>;
  pinNote(noteId: string): Promise<void>;
  unpinNote(noteId: string): Promise<void>;
  searchNotes(query: string, filters?: { entityType?: string; visibility?: string; }): Promise<Note[]>;

  // Note Tags
  getNoteTags(): Promise<NoteTag[]>;
  createNoteTag(tag: InsertNoteTag): Promise<NoteTag>;
  assignTagToNote(noteId: string, tagId: string): Promise<void>;
  removeTagFromNote(noteId: string, tagId: string): Promise<void>;

  // Note Mentions
  createNoteMention(mention: InsertNoteMention): Promise<NoteMention>;
  getNoteMentions(noteId: string): Promise<NoteMention[]>;
  markMentionRead(mentionId: string): Promise<void>;

  // Note Reactions
  addReaction(reaction: InsertNoteReaction): Promise<NoteReaction>;
  removeReaction(noteId: string, userId: string, emoji: string): Promise<void>;
  getNoteReactions(noteId: string): Promise<NoteReaction[]>;

  // Note Attachments
  createNoteAttachment(attachment: InsertNoteAttachment): Promise<NoteAttachment>;
  getNoteAttachments(noteId: string): Promise<NoteAttachment[]>;
  deleteNoteAttachment(id: string): Promise<void>;

  // Note Follow-ups
  createNoteFollowup(followup: InsertNoteFollowup): Promise<NoteFollowup>;
  getNoteFollowups(noteId: string): Promise<NoteFollowup[]>;

  // Note Revisions
  createNoteRevision(revision: InsertNoteRevision): Promise<NoteRevision>;
  getNoteRevisions(noteId: string): Promise<NoteRevision[]>;

  // Note Templates
  getNoteTemplates(entityType?: string): Promise<NoteTemplate[]>;
  createNoteTemplate(template: InsertNoteTemplate): Promise<NoteTemplate>;
  updateNoteTemplate(id: string, updates: Partial<InsertNoteTemplate>): Promise<NoteTemplate>;
  deleteNoteTemplate(id: string): Promise<void>;

  // Note Links
  createNoteLink(link: InsertNoteLink): Promise<NoteLink>;
  getNoteLinks(noteId: string): Promise<NoteLink[]>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

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

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const result = await db.update(users).set({
      ...updates,
      updatedAt: new Date(),
    }).where(eq(users.id, id)).returning();
    if (result.length === 0) {
      throw new Error("User not found");
    }
    return result[0];
  }

  async deleteUser(id: string): Promise<void> {
    const result = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    if (result.length === 0) {
      throw new Error("User not found");
    }
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
    // Sort by order date descending (newest orders first), NULL dates go to end
    return await db.select().from(orders).orderBy(sql`${orders.orderDate} DESC NULLS LAST`).limit(limit);
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
    
    // Get paginated orders with search filter, sorted by date (newest first)
    // Use sql`` to add NULLS LAST to prevent NULL dates from appearing in middle of results
    const ordersQuery = db
      .select()
      .from(orders)
      .orderBy(sql`${orders.orderDate} DESC NULLS LAST`)
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
  async getEmailThreads(filters?: {
    limit?: number;
    folder?: string;
    starred?: boolean;
    archived?: boolean;
    isUnread?: boolean;
    hasOrder?: boolean;
  }): Promise<EmailThread[]> {
    const { limit = 50, folder, starred, archived, isUnread, hasOrder } = filters || {};
    
    let query = db.select().from(emailThreads);
    const conditions = [];
    
    // Handle virtual folders that map to combinations of flags
    if (folder === 'inbox') {
      conditions.push(eq(emailThreads.folder, 'inbox'));
      conditions.push(eq(emailThreads.archived, false));
    } else if (folder === 'sent') {
      conditions.push(eq(emailThreads.folder, 'sent'));
    } else if (folder === 'archived') {
      conditions.push(eq(emailThreads.archived, true));
    } else if (folder === 'starred') {
      conditions.push(eq(emailThreads.starred, true));
    } else if (folder === 'unread') {
      conditions.push(eq(emailThreads.isUnread, true));
    } else if (folder && ['inbox', 'sent'].includes(folder)) {
      conditions.push(eq(emailThreads.folder, folder as any));
    }
    
    // Additional filters
    if (starred !== undefined) {
      conditions.push(eq(emailThreads.starred, starred));
    }
    if (archived !== undefined) {
      conditions.push(eq(emailThreads.archived, archived));
    }
    if (isUnread !== undefined) {
      conditions.push(eq(emailThreads.isUnread, isUnread));
    }
    if (hasOrder !== undefined) {
      if (hasOrder) {
        conditions.push(sql`${emailThreads.orderId} IS NOT NULL`);
      } else {
        conditions.push(sql`${emailThreads.orderId} IS NULL`);
      }
    }
    
    // Apply all conditions
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(emailThreads.lastActivity)).limit(limit);
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

  async deleteEmailThread(id: string): Promise<void> {
    await db.delete(emailThreads).where(eq(emailThreads.id, id));
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

  async deleteRepair(id: string): Promise<void> {
    await db.delete(repairs).where(eq(repairs.id, id));
  }

  async getRepairsByStatus(status: string): Promise<Repair[]> {
    return await db.select().from(repairs).where(eq(repairs.status, status as any));
  }

  async getRepairsByTechnician(technicianId: string): Promise<Repair[]> {
    return await db.select().from(repairs).where(eq(repairs.assignedUserId, technicianId)).orderBy(desc(repairs.createdAt));
  }

  async getRepairsByDateRange(startDate: Date, endDate: Date): Promise<Repair[]> {
    return await db.select().from(repairs)
      .where(and(
        sql`${repairs.createdAt} >= ${startDate}`,
        sql`${repairs.createdAt} <= ${endDate}`
      ))
      .orderBy(desc(repairs.createdAt));
  }

  async getRepairsWithFilters(filters: {
    status?: string;
    technicianId?: string;
    startDate?: Date;
    endDate?: Date;
    priority?: string;
  }): Promise<Repair[]> {
    const conditions = [];
    
    if (filters.status) {
      conditions.push(eq(repairs.status, filters.status as any));
    }
    if (filters.technicianId) {
      conditions.push(eq(repairs.assignedUserId, filters.technicianId));
    }
    if (filters.startDate) {
      conditions.push(sql`${repairs.createdAt} >= ${filters.startDate}`);
    }
    if (filters.endDate) {
      conditions.push(sql`${repairs.createdAt} <= ${filters.endDate}`);
    }
    if (filters.priority) {
      conditions.push(eq(repairs.priority, filters.priority as any));
    }

    if (conditions.length === 0) {
      return await db.select().from(repairs).orderBy(desc(repairs.createdAt));
    }

    return await db.select().from(repairs)
      .where(and(...conditions))
      .orderBy(desc(repairs.createdAt));
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
  async getInternalNotes(entityType: string, entityId: string): Promise<InternalNote[]> {
    const column = entityType === 'customer' ? internalNotes.customerId :
                  entityType === 'order' ? internalNotes.orderId :
                  entityType === 'repair' ? internalNotes.repairId :
                  entityType === 'case' ? internalNotes.caseId :
                  entityType === 'return' ? internalNotes.returnId :
                  internalNotes.emailThreadId;
    
    return await db.select().from(internalNotes).where(eq(column, entityId)).orderBy(desc(internalNotes.createdAt));
  }

  async createInternalNote(note: InsertInternalNote): Promise<InternalNote> {
    const result = await db.insert(internalNotes).values(note).returning();
    return result[0];
  }

  async deleteInternalNote(noteId: string): Promise<void> {
    await db.delete(internalNotes).where(eq(internalNotes.id, noteId));
  }

  // Cases
  async getCases(status?: string, search?: string, emailThreadId?: string): Promise<any[]> {
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
    
    // Get cases with notes count and related data
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const casesData = await db
      .select({
        ...getTableColumns(cases),
        notesCount: sql<number>`COALESCE((
          SELECT COUNT(*)::int 
          FROM ${notes} 
          WHERE ${notes.entityType} = 'case' 
          AND ${notes.entityId} = ${cases.id}
          AND ${notes.deletedAt} IS NULL
        ), 0)`,
      })
      .from(cases)
      .where(whereClause)
      .orderBy(desc(cases.createdAt));
    
    return casesData;
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
    // First delete all related records that have foreign key constraints
    
    // Delete case events
    await db.delete(caseEvents).where(eq(caseEvents.caseId, id));
    
    // Delete case notes
    await db.delete(caseNotes).where(eq(caseNotes.caseId, id));
    
    // Delete case links
    await db.delete(caseLinks).where(eq(caseLinks.caseId, id));
    
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

  async createCaseWithItems(caseData: InsertCase, items: Omit<InsertCaseItem, 'caseId'>[]): Promise<Case> {
    // Retry loop to handle concurrent case creation with unique constraint conflicts
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Use transaction to ensure atomicity
        const newCase = await db.transaction(async (tx) => {
          // Generate case number within transaction to prevent duplicates
          // Fetch all case numbers and find max numerically to handle numbers beyond 3 digits
          const existingCases = await tx.select({ caseNumber: cases.caseNumber }).from(cases);
          
          const maxNumber = existingCases
            .map(c => {
              const match = c.caseNumber.match(/^CASE-(\d+)$/);
              return match ? parseInt(match[1], 10) : 0;
            })
            .reduce((max, num) => Math.max(max, num), 0);
          
          const newCaseNumber = `CASE-${String(maxNumber + 1).padStart(3, '0')}`;
          
          // Normalize date fields
          const createData = {
            ...caseData,
            caseNumber: newCaseNumber
          };

          if (createData.slaDeadline && typeof createData.slaDeadline === 'string') {
            createData.slaDeadline = new Date(createData.slaDeadline);
          }
          if (createData.resolvedAt && typeof createData.resolvedAt === 'string') {
            createData.resolvedAt = new Date(createData.resolvedAt);
          }
          if (createData.closedAt && typeof createData.closedAt === 'string') {
            createData.closedAt = new Date(createData.closedAt);
          }

          // Create case within transaction
          const caseResult = await tx.insert(cases).values(createData as any).returning();
          const createdCase = caseResult[0];
          
          // Create case items within transaction if provided
          if (items && items.length > 0) {
            const itemsWithCaseId = items.map(item => ({
              ...item,
              caseId: createdCase.id,
            }));
            
            await tx.insert(caseItems).values(itemsWithCaseId as any);
          }
          
          return createdCase;
        });
        
        // Success - return the created case
        return newCase;
      } catch (error: any) {
        // Check if this is a unique constraint violation on case_number
        if (error?.code === '23505' && error?.constraint?.includes('case_number')) {
          lastError = error;
          // Retry with a new number
          continue;
        }
        // For other errors, throw immediately
        throw error;
      }
    }

    // If we exhausted all retries, throw a clear error
    throw new Error(`Failed to create case after ${maxRetries} attempts due to concurrent case number conflicts. Please try again.`, { cause: lastError });
  }

  async getCaseItems(caseId: string): Promise<CaseItem[]> {
    return await db.select().from(caseItems).where(eq(caseItems.caseId, caseId)).orderBy(caseItems.createdAt);
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

  // Case Links
  async getCaseLinks(caseId: string): Promise<CaseLink[]> {
    return await db.select().from(caseLinks).where(eq(caseLinks.caseId, caseId));
  }

  async createCaseLink(link: InsertCaseLink): Promise<CaseLink> {
    const result = await db.insert(caseLinks).values(link).returning();
    return result[0];
  }

  async deleteCaseLink(linkId: string): Promise<void> {
    await db.delete(caseLinks).where(eq(caseLinks.id, linkId));
  }

  // Case Notes
  async getCaseNotes(caseId: string): Promise<CaseNote[]> {
    return await db.select().from(caseNotes).where(eq(caseNotes.caseId, caseId)).orderBy(desc(caseNotes.createdAt));
  }

  async createCaseNote(note: InsertCaseNote): Promise<CaseNote> {
    const result = await db.insert(caseNotes).values(note).returning();
    return result[0];
  }

  // Case Events
  async getCaseEvents(caseId: string): Promise<CaseEvent[]> {
    return await db.select().from(caseEvents).where(eq(caseEvents.caseId, caseId)).orderBy(desc(caseEvents.createdAt));
  }

  async createCaseEvent(event: InsertCaseEvent): Promise<CaseEvent> {
    const result = await db.insert(caseEvents).values(event).returning();
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

  async updateActivity(id: string, activity: Partial<InsertActivity>): Promise<Activity> {
    const result = await db.update(activities).set(activity).where(eq(activities.id, id)).returning();
    return result[0];
  }

  async deleteActivity(id: string): Promise<void> {
    await db.delete(activities).where(eq(activities.id, id));
  }

  // Audit Logs
  async createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(auditLog).returning();
    return result[0];
  }

  async getAuditLogs(limit: number = 50): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
  }

  // System Settings
  async getSystemSetting(key: string): Promise<string | undefined> {
    const result = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
    return result[0]?.value;
  }

  async setSystemSetting(key: string, value: string): Promise<void> {
    const existing = await this.getSystemSetting(key);
    if (existing) {
      await db.update(systemSettings).set({ value, updatedAt: new Date() }).where(eq(systemSettings.key, key));
    } else {
      await db.insert(systemSettings).values({ key, value });
    }
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

  // Suppliers
  async getSuppliers(): Promise<Supplier[]> {
    return await db.select().from(suppliers).where(eq(suppliers.active, true)).orderBy(suppliers.name);
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    const result = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    return result[0];
  }

  async getSupplierByCode(code: string): Promise<Supplier | undefined> {
    const result = await db.select().from(suppliers).where(eq(suppliers.supplierCode, code)).limit(1);
    return result[0];
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const result = await db.insert(suppliers).values(supplier as any).returning();
    return result[0];
  }

  async updateSupplier(id: string, supplier: Partial<InsertSupplier>): Promise<Supplier> {
    const result = await db.update(suppliers).set({ ...supplier, updatedAt: new Date() } as any).where(eq(suppliers.id, id)).returning();
    return result[0];
  }

  async deleteSupplier(id: string): Promise<void> {
    // Soft delete
    await db.update(suppliers).set({ active: false, updatedAt: new Date() }).where(eq(suppliers.id, id));
  }

  async importSuppliers(suppliersData: InsertSupplier[]): Promise<void> {
    // Batch insert suppliers
    for (const supplier of suppliersData) {
      // Check if supplier already exists by code
      const existing = await this.getSupplierByCode(supplier.supplierCode);
      if (!existing) {
        await this.createSupplier(supplier);
      }
    }
  }

  // Purchase Orders
  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    return await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt));
  }

  async generatePONumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await db.select({ poNumber: purchaseOrders.poNumber }).from(purchaseOrders).where(sql`${purchaseOrders.poNumber} LIKE ${`PO-${year}-%`}`).orderBy(desc(purchaseOrders.poNumber)).limit(1);
    
    if (result.length === 0) {
      return `PO-${year}-001`;
    }
    
    const lastNumber = parseInt(result[0].poNumber!.split('-')[2]) || 0;
    const nextNumber = (lastNumber + 1).toString().padStart(3, '0');
    return `PO-${year}-${nextNumber}`;
  }

  async getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined> {
    const result = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
    return result[0];
  }

  async createPurchaseOrder(purchaseOrder: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const result = await db.insert(purchaseOrders).values(purchaseOrder as any).returning();
    return result[0];
  }

  async createPurchaseOrderWithItems(purchaseOrder: InsertPurchaseOrder, items: Omit<InsertPurchaseOrderItem, 'purchaseOrderId'>[] = []): Promise<PurchaseOrder> {
    // Use transaction to ensure atomicity (including PO number generation)
    const newPurchaseOrder = await db.transaction(async (tx) => {
      // Generate PO number within transaction to prevent conflicts
      const existingOrders = await tx.select({ poNumber: purchaseOrders.poNumber }).from(purchaseOrders);
      const year = new Date().getFullYear();
      const yearPrefix = `PO-${year}-`;
      
      const maxNumber = existingOrders
        .map(p => {
          const match = p.poNumber?.match(new RegExp(`^PO-${year}-(\\d+)$`));
          return match ? parseInt(match[1], 10) : 0;
        })
        .reduce((max, num) => Math.max(max, num), 0);
      
      const poNumber = `${yearPrefix}${String(maxNumber + 1).padStart(4, '0')}`;
      
      // Create purchase order within transaction
      const result = await tx.insert(purchaseOrders).values({ 
        ...purchaseOrder, 
        poNumber 
      } as any).returning();
      
      const createdPurchaseOrder = result[0];
      
      // Create purchase order items within transaction if provided
      if (items && items.length > 0) {
        // Validate and normalize items
        const normalizedItems = items.map(item => {
          // Ensure required fields
          if (!item.productName || item.quantity == null || item.unitPrice == null) {
            throw new Error(`Invalid purchase order item: missing required fields (productName, quantity, or unitPrice)`);
          }
          
          // Normalize price fields to cents if they're not already
          const unitPriceCents = typeof item.unitPrice === 'number' && item.unitPrice < 1000
            ? Math.round(item.unitPrice * 100)
            : Math.round(item.unitPrice);
          
          const subtotalCents = Math.round(item.quantity * unitPriceCents);
          
          return {
            ...item,
            purchaseOrderId: createdPurchaseOrder.id,
            unitPrice: unitPriceCents,
            subtotal: subtotalCents,
            sku: item.sku || '',
          };
        });
        
        await tx.insert(purchaseOrderItems).values(normalizedItems as any);
      }
      
      return createdPurchaseOrder;
    });
    
    // Create activity log (outside transaction, non-critical)
    const itemCount = items?.length || 0;
    await this.createActivity({
      type: 'purchase_order_created',
      description: `Purchase order ${newPurchaseOrder.poNumber} created with ${itemCount} item(s)`,
      metadata: { purchaseOrderId: newPurchaseOrder.id, itemCount },
    });
    
    return newPurchaseOrder;
  }

  async updatePurchaseOrder(id: string, purchaseOrder: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder> {
    const result = await db.update(purchaseOrders).set(purchaseOrder as any).where(eq(purchaseOrders.id, id)).returning();
    return result[0];
  }

  async deletePurchaseOrder(id: string): Promise<void> {
    // Delete all associated items and files first (foreign key constraints)
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
    await db.delete(purchaseOrderFiles).where(eq(purchaseOrderFiles.purchaseOrderId, id));
    // Then delete the purchase order
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
  }

  // Purchase Order Items
  async getPurchaseOrderItems(purchaseOrderId: string): Promise<PurchaseOrderItem[]> {
    return await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId)).orderBy(purchaseOrderItems.createdAt);
  }

  async createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const result = await db.insert(purchaseOrderItems).values(item as any).returning();
    return result[0];
  }

  async updatePurchaseOrderItem(id: string, item: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem> {
    const result = await db.update(purchaseOrderItems).set({ ...item, updatedAt: new Date() } as any).where(eq(purchaseOrderItems.id, id)).returning();
    return result[0];
  }

  async deletePurchaseOrderItem(id: string): Promise<void> {
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));
  }

  // Purchase Order Files
  async getPurchaseOrderFiles(purchaseOrderId: string): Promise<PurchaseOrderFile[]> {
    return await db.select().from(purchaseOrderFiles).where(eq(purchaseOrderFiles.purchaseOrderId, purchaseOrderId)).orderBy(purchaseOrderFiles.uploadedAt);
  }

  async getPurchaseOrderFile(id: string): Promise<PurchaseOrderFile | undefined> {
    const result = await db.select().from(purchaseOrderFiles).where(eq(purchaseOrderFiles.id, id)).limit(1);
    return result[0];
  }

  async createPurchaseOrderFile(file: InsertPurchaseOrderFile): Promise<PurchaseOrderFile> {
    const result = await db.insert(purchaseOrderFiles).values(file as any).returning();
    return result[0];
  }

  async deletePurchaseOrderFile(id: string): Promise<void> {
    await db.delete(purchaseOrderFiles).where(eq(purchaseOrderFiles.id, id));
  }

  // Returns
  async getReturns(filters?: { status?: string; customerId?: string; orderId?: string; assignedUserId?: string }): Promise<Return[]> {
    let query = db.select().from(returns);
    
    if (filters) {
      const conditions = [];
      if (filters.status) conditions.push(eq(returns.status, filters.status as any));
      if (filters.customerId) conditions.push(eq(returns.customerId, filters.customerId));
      if (filters.orderId) conditions.push(eq(returns.orderId, filters.orderId));
      if (filters.assignedUserId) conditions.push(eq(returns.assignedUserId, filters.assignedUserId));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
    }
    
    return await query.orderBy(desc(returns.createdAt));
  }

  async getReturn(id: string): Promise<Return | undefined> {
    const result = await db.select().from(returns).where(eq(returns.id, id)).limit(1);
    return result[0];
  }

  async getReturnByReturnNumber(returnNumber: string): Promise<Return | undefined> {
    const result = await db.select().from(returns).where(eq(returns.returnNumber, returnNumber)).limit(1);
    return result[0];
  }

  async generateReturnNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await db.select({ returnNumber: returns.returnNumber })
      .from(returns)
      .where(sql`${returns.returnNumber} LIKE ${`RET-${year}-%`}`)
      .orderBy(desc(returns.returnNumber))
      .limit(1);
    
    if (result.length === 0) {
      return `RET-${year}-001`;
    }
    
    const lastNumber = parseInt(result[0].returnNumber!.split('-')[2]) || 0;
    const nextNumber = (lastNumber + 1).toString().padStart(3, '0');
    return `RET-${year}-${nextNumber}`;
  }

  async createReturn(returnData: InsertReturn): Promise<Return> {
    const returnNumber = await this.generateReturnNumber();
    const result = await db.insert(returns).values({ 
      ...returnData, 
      returnNumber 
    } as any).returning();
    
    // Create activity log
    await this.createActivity({
      type: 'return_created',
      description: `Return ${returnNumber} created`,
      metadata: { returnId: result[0].id },
    });
    
    return result[0];
  }

  async createReturnWithItems(returnData: InsertReturn, items: Omit<InsertReturnItem, 'returnId'>[]): Promise<Return> {
    const returnNumber = await this.generateReturnNumber();
    
    // Use transaction to ensure atomicity
    const newReturn = await db.transaction(async (tx) => {
      // Create return within transaction
      const result = await tx.insert(returns).values({ 
        ...returnData, 
        returnNumber 
      } as any).returning();
      
      const createdReturn = result[0];
      
      // Create return items within transaction if provided
      if (items && items.length > 0) {
        const itemsWithReturnId = items.map(item => ({
          ...item,
          returnId: createdReturn.id,
        }));
        
        await tx.insert(returnItems).values(itemsWithReturnId as any);
      }
      
      return createdReturn;
    });
    
    // Create activity log (outside transaction, non-critical)
    await this.createActivity({
      type: 'return_created',
      description: `Return ${returnNumber} created with ${items.length} item(s)`,
      metadata: { returnId: newReturn.id, itemCount: items.length },
    });
    
    return newReturn;
  }

  async updateReturn(id: string, returnData: Partial<InsertReturn>): Promise<Return> {
    const result = await db.update(returns)
      .set({ ...returnData, updatedAt: new Date() } as any)
      .where(eq(returns.id, id))
      .returning();
    
    return result[0];
  }

  async deleteReturn(id: string): Promise<void> {
    // Delete return items first
    await db.delete(returnItems).where(eq(returnItems.returnId, id));
    // Delete return
    await db.delete(returns).where(eq(returns.id, id));
  }

  async getReturnsByStatus(status: string): Promise<Return[]> {
    return await db.select().from(returns).where(eq(returns.status, status as any)).orderBy(desc(returns.createdAt));
  }

  async getReturnsByCustomer(customerId: string): Promise<Return[]> {
    return await db.select().from(returns).where(eq(returns.customerId, customerId)).orderBy(desc(returns.createdAt));
  }

  async createReturnFromCase(caseId: string): Promise<Return> {
    // Get case details
    const caseData = await this.getCase(caseId);
    if (!caseData) {
      throw new Error('Case not found');
    }

    // Create return with case information
    const returnNumber = await this.generateReturnNumber();
    const result = await db.insert(returns).values({
      returnNumber,
      caseId,
      customerId: caseData.customerId || undefined,
      status: 'nieuw_onderweg',
      priority: caseData.priority || 'medium',
      requestedAt: new Date(),
    } as any).returning();

    // Create case link
    await this.createCaseLink({
      caseId,
      linkType: 'return',
      linkedId: result[0].id,
    });

    // Create case event
    await this.createCaseEvent({
      caseId,
      eventType: 'link_added',
      message: `Return ${returnNumber} created from case`,
      metadata: { returnId: result[0].id },
    });

    return result[0];
  }

  // Return Items
  async getReturnItems(returnId: string): Promise<ReturnItem[]> {
    return await db.select().from(returnItems).where(eq(returnItems.returnId, returnId)).orderBy(returnItems.createdAt);
  }

  async createReturnItem(item: InsertReturnItem): Promise<ReturnItem> {
    const result = await db.insert(returnItems).values(item as any).returning();
    return result[0];
  }

  async updateReturnItem(id: string, item: Partial<InsertReturnItem>): Promise<ReturnItem> {
    const result = await db.update(returnItems)
      .set({ ...item, updatedAt: new Date() } as any)
      .where(eq(returnItems.id, id))
      .returning();
    return result[0];
  }

  async deleteReturnItem(id: string): Promise<void> {
    await db.delete(returnItems).where(eq(returnItems.id, id));
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
        ilike(purchaseOrders.poNumber, searchTerm),
        ilike(purchaseOrders.notes, searchTerm)
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

  async downloadAttachment(attachmentPath: string, res: Response, forceDownload: boolean = false): Promise<void> {
    const objectStorageService = new ObjectStorageService();
    const file = await objectStorageService.getAttachmentFile(attachmentPath);
    await objectStorageService.downloadObject(file, res, 3600, forceDownload);
  }

  // Notes (Universal)
  async getNotes(entityType: string, entityId: string, filters?: { visibility?: string; tagIds?: string[]; authorId?: string; }): Promise<Note[]> {
    const conditions = [
      eq(notes.entityType, entityType as any),
      eq(notes.entityId, entityId),
      sql`${notes.deletedAt} IS NULL`
    ];

    if (filters?.visibility) {
      conditions.push(eq(notes.visibility, filters.visibility as any));
    }

    if (filters?.authorId) {
      conditions.push(eq(notes.authorId, filters.authorId));
    }

    let query = db.select().from(notes).where(and(...conditions));

    if (filters?.tagIds && filters.tagIds.length > 0) {
      const notesWithTags = await db
        .select({ noteId: noteTagAssignments.noteId })
        .from(noteTagAssignments)
        .where(inArray(noteTagAssignments.tagId, filters.tagIds));
      
      const noteIds = notesWithTags.map(nt => nt.noteId);
      if (noteIds.length > 0) {
        conditions.push(inArray(notes.id, noteIds));
      } else {
        return [];
      }
    }

    return await query.orderBy(desc(notes.isPinned), desc(notes.createdAt));
  }

  async getNote(id: string): Promise<Note | undefined> {
    const result = await db.select().from(notes).where(
      and(
        eq(notes.id, id),
        sql`${notes.deletedAt} IS NULL`
      )
    ).limit(1);
    return result[0];
  }

  async createNote(note: InsertNote): Promise<Note> {
    const result = await db.insert(notes).values(note as any).returning();
    return result[0];
  }

  async updateNote(id: string, updates: Partial<InsertNote>): Promise<Note> {
    const result = await db.update(notes).set({
      ...updates,
      updatedAt: new Date(),
      editedAt: new Date()
    } as any).where(eq(notes.id, id)).returning();
    if (result.length === 0) {
      throw new Error("Note not found");
    }
    return result[0];
  }

  async deleteNote(id: string, reason: string, userId: string): Promise<void> {
    const result = await db.update(notes).set({
      deletedAt: new Date(),
      deletedBy: userId,
      deleteReason: reason
    } as any).where(eq(notes.id, id)).returning();
    if (result.length === 0) {
      throw new Error("Note not found");
    }
  }

  async pinNote(noteId: string): Promise<void> {
    const note = await this.getNote(noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    const pinnedNotes = await db.select().from(notes).where(
      and(
        eq(notes.entityType, note.entityType),
        eq(notes.entityId, note.entityId),
        eq(notes.isPinned, true),
        sql`${notes.deletedAt} IS NULL`
      )
    );

    if (pinnedNotes.length >= 3) {
      throw new Error("Maximum 3 pinned notes per entity reached");
    }

    await db.update(notes).set({
      isPinned: true,
      pinnedAt: new Date()
    } as any).where(eq(notes.id, noteId));
  }

  async unpinNote(noteId: string): Promise<void> {
    await db.update(notes).set({
      isPinned: false,
      pinnedAt: null,
      pinnedBy: null
    } as any).where(eq(notes.id, noteId));
  }

  async searchNotes(query: string, filters?: { entityType?: string; visibility?: string; }): Promise<Note[]> {
    const searchTerm = `%${query}%`;
    const conditions = [
      sql`${notes.deletedAt} IS NULL`,
      or(
        ilike(notes.content, searchTerm),
        ilike(notes.plainText, searchTerm)
      )
    ];

    if (filters?.entityType) {
      conditions.push(eq(notes.entityType, filters.entityType as any));
    }

    if (filters?.visibility) {
      conditions.push(eq(notes.visibility, filters.visibility as any));
    }

    return await db.select().from(notes).where(and(...conditions)).orderBy(desc(notes.createdAt)).limit(50);
  }

  // Note Tags
  async getNoteTags(): Promise<NoteTag[]> {
    return await db.select().from(noteTags).orderBy(noteTags.name);
  }

  async createNoteTag(tag: InsertNoteTag): Promise<NoteTag> {
    const result = await db.insert(noteTags).values(tag as any).returning();
    return result[0];
  }

  async assignTagToNote(noteId: string, tagId: string): Promise<void> {
    await db.insert(noteTagAssignments).values({
      noteId,
      tagId
    } as any);
  }

  async removeTagFromNote(noteId: string, tagId: string): Promise<void> {
    await db.delete(noteTagAssignments).where(
      and(
        eq(noteTagAssignments.noteId, noteId),
        eq(noteTagAssignments.tagId, tagId)
      )
    );
  }

  // Note Mentions
  async createNoteMention(mention: InsertNoteMention): Promise<NoteMention> {
    const result = await db.insert(noteMentions).values(mention as any).returning();
    return result[0];
  }

  async getNoteMentions(noteId: string): Promise<NoteMention[]> {
    return await db.select().from(noteMentions).where(eq(noteMentions.noteId, noteId));
  }

  async markMentionRead(mentionId: string): Promise<void> {
    await db.update(noteMentions).set({
      notified: true,
      notifiedAt: new Date()
    } as any).where(eq(noteMentions.id, mentionId));
  }

  // Note Reactions
  async addReaction(reaction: InsertNoteReaction): Promise<NoteReaction> {
    const result = await db.insert(noteReactions).values(reaction as any).returning();
    return result[0];
  }

  async removeReaction(noteId: string, userId: string, emoji: string): Promise<void> {
    await db.delete(noteReactions).where(
      and(
        eq(noteReactions.noteId, noteId),
        eq(noteReactions.userId, userId),
        eq(noteReactions.emoji, emoji)
      )
    );
  }

  async getNoteReactions(noteId: string): Promise<NoteReaction[]> {
    return await db.select().from(noteReactions).where(eq(noteReactions.noteId, noteId));
  }

  // Note Attachments
  async createNoteAttachment(attachment: InsertNoteAttachment): Promise<NoteAttachment> {
    const result = await db.insert(noteAttachments).values(attachment as any).returning();
    return result[0];
  }

  async getNoteAttachments(noteId: string): Promise<NoteAttachment[]> {
    return await db.select().from(noteAttachments).where(eq(noteAttachments.noteId, noteId));
  }

  async deleteNoteAttachment(id: string): Promise<void> {
    await db.delete(noteAttachments).where(eq(noteAttachments.id, id));
  }

  // Note Follow-ups
  async createNoteFollowup(followup: InsertNoteFollowup): Promise<NoteFollowup> {
    const result = await db.insert(noteFollowups).values(followup as any).returning();
    return result[0];
  }

  async getNoteFollowups(noteId: string): Promise<NoteFollowup[]> {
    return await db.select().from(noteFollowups).where(eq(noteFollowups.noteId, noteId));
  }

  // Note Revisions
  async createNoteRevision(revision: InsertNoteRevision): Promise<NoteRevision> {
    const result = await db.insert(noteRevisions).values(revision as any).returning();
    return result[0];
  }

  async getNoteRevisions(noteId: string): Promise<NoteRevision[]> {
    return await db.select().from(noteRevisions).where(eq(noteRevisions.noteId, noteId)).orderBy(desc(noteRevisions.editedAt));
  }

  // Note Templates
  async getNoteTemplates(entityType?: string): Promise<NoteTemplate[]> {
    if (entityType) {
      return await db.select().from(noteTemplates).where(
        and(
          eq(noteTemplates.isActive, true),
          or(
            eq(noteTemplates.entityType, entityType as any),
            eq(noteTemplates.scope, 'global')
          )
        )
      ).orderBy(noteTemplates.name);
    }
    return await db.select().from(noteTemplates).where(eq(noteTemplates.isActive, true)).orderBy(noteTemplates.name);
  }

  async createNoteTemplate(template: InsertNoteTemplate): Promise<NoteTemplate> {
    const result = await db.insert(noteTemplates).values(template as any).returning();
    return result[0];
  }

  async updateNoteTemplate(id: string, updates: Partial<InsertNoteTemplate>): Promise<NoteTemplate> {
    const result = await db.update(noteTemplates).set({
      ...updates,
      updatedAt: new Date()
    } as any).where(eq(noteTemplates.id, id)).returning();
    if (result.length === 0) {
      throw new Error("Note template not found");
    }
    return result[0];
  }

  async deleteNoteTemplate(id: string): Promise<void> {
    await db.update(noteTemplates).set({
      isActive: false,
      updatedAt: new Date()
    } as any).where(eq(noteTemplates.id, id));
  }

  // Note Links
  async createNoteLink(link: InsertNoteLink): Promise<NoteLink> {
    const result = await db.insert(noteLinks).values(link as any).returning();
    return result[0];
  }

  async getNoteLinks(noteId: string): Promise<NoteLink[]> {
    return await db.select().from(noteLinks).where(eq(noteLinks.noteId, noteId));
  }
}

export const storage = new DatabaseStorage();
