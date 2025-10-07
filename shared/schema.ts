import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["ADMIN", "SUPPORT", "TECHNICUS"]);
export const priorityEnum = pgEnum("priority", ["low", "medium", "high", "urgent"]);
export const repairStatusEnum = pgEnum("repair_status", ["new", "in_progress", "waiting_customer", "waiting_part", "ready", "closed"]);
export const todoStatusEnum = pgEnum("todo_status", ["todo", "in_progress", "done"]);
export const todoCategoryEnum = pgEnum("todo_category", ["orders", "purchasing", "marketing", "admin", "other"]);
export const emailStatusEnum = pgEnum("email_status", ["open", "closed", "archived"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"]);
export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", ["draft", "sent", "awaiting_delivery", "partially_received", "fully_received", "cancelled"]);
export const caseStatusEnum = pgEnum("case_status", ["new", "in_progress", "waiting_customer", "waiting_part", "resolved", "closed"]);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default("SUPPORT"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Customers table
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  shopifyCustomerId: text("shopify_customer_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Orders table (synced from Shopify)
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shopifyOrderId: text("shopify_order_id").notNull().unique(),
  orderNumber: text("order_number").notNull(),
  customerId: varchar("customer_id").references(() => customers.id),
  customerEmail: text("customer_email"),
  totalAmount: integer("total_amount"), // in cents
  currency: text("currency").default("EUR"),
  status: orderStatusEnum("status").notNull(),
  fulfillmentStatus: text("fulfillment_status"),
  paymentStatus: text("payment_status"),
  orderData: jsonb("order_data"), // raw Shopify order data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Email threads table
export const emailThreads = pgTable("email_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: text("thread_id").notNull().unique(), // from email provider
  subject: text("subject"),
  customerId: varchar("customer_id").references(() => customers.id),
  customerEmail: text("customer_email"),
  assignedUserId: varchar("assigned_user_id").references(() => users.id),
  status: emailStatusEnum("status").notNull().default("open"),
  priority: priorityEnum("priority").default("medium"),
  hasAttachment: boolean("has_attachment").default(false),
  isUnread: boolean("is_unread").default(true),
  lastActivity: timestamp("last_activity").defaultNow(),
  slaDeadline: timestamp("sla_deadline"),
  orderId: varchar("order_id").references(() => orders.id),
  caseId: varchar("case_id").references(() => cases.id), // Link email threads to cases
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Email messages table
export const emailMessages = pgTable("email_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: text("message_id").notNull().unique(), // from email provider
  threadId: varchar("thread_id").references(() => emailThreads.id).notNull(),
  fromEmail: text("from_email").notNull(),
  toEmail: text("to_email").notNull(),
  subject: text("subject"),
  body: text("body"),
  isHtml: boolean("is_html").default(false),
  isOutbound: boolean("is_outbound").default(false),
  attachments: jsonb("attachments"), // array of attachment metadata
  rawData: jsonb("raw_data"), // raw email data
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Repairs table
export const repairs = pgTable("repairs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  customerId: varchar("customer_id").references(() => customers.id),
  orderId: varchar("order_id").references(() => orders.id),
  emailThreadId: varchar("email_thread_id").references(() => emailThreads.id),
  assignedUserId: varchar("assigned_user_id").references(() => users.id),
  status: repairStatusEnum("status").notNull().default("new"),
  priority: priorityEnum("priority").default("medium"),
  estimatedCost: integer("estimated_cost"), // in cents
  actualCost: integer("actual_cost"), // in cents
  partsNeeded: text("parts_needed").array(),
  photos: text("photos").array(), // URLs to stored photos
  timeline: jsonb("timeline"), // array of status updates
  slaDeadline: timestamp("sla_deadline"),
  completedAt: timestamp("completed_at"),
  caseId: varchar("case_id").references(() => cases.id), // Link repairs to cases
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Todos table
export const todos = pgTable("todos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: todoCategoryEnum("category").default("other"),
  assignedUserId: varchar("assigned_user_id").references(() => users.id).notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  status: todoStatusEnum("status").notNull().default("todo"),
  priority: priorityEnum("priority").default("medium"),
  dueDate: timestamp("due_date"),
  // Linkable to various entities
  customerId: varchar("customer_id").references(() => customers.id),
  orderId: varchar("order_id").references(() => orders.id),
  repairId: varchar("repair_id").references(() => repairs.id),
  emailThreadId: varchar("email_thread_id").references(() => emailThreads.id),
  caseId: varchar("case_id").references(() => cases.id), // Link todos to cases
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Internal notes table
export const internalNotes = pgTable("internal_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  authorId: varchar("author_id").references(() => users.id).notNull(),
  // Can be attached to various entities
  customerId: varchar("customer_id").references(() => customers.id),
  orderId: varchar("order_id").references(() => orders.id),
  repairId: varchar("repair_id").references(() => repairs.id),
  emailThreadId: varchar("email_thread_id").references(() => emailThreads.id),
  caseId: varchar("case_id").references(() => cases.id), // Link notes to cases
  mentions: text("mentions").array(), // user IDs mentioned in the note
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Email attachments table
export const emailAttachments = pgTable("email_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").references(() => emailMessages.id).notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type"),
  size: integer("size"), // in bytes
  storageUrl: text("storage_url").notNull(), // path in object storage
  contentId: text("content_id"), // for inline attachments
  isInline: boolean("is_inline").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Cases table - Central overarching object for customer requests
export const cases = pgTable("cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  customerId: varchar("customer_id").references(() => customers.id),
  customerEmail: text("customer_email"),
  assignedUserId: varchar("assigned_user_id").references(() => users.id),
  status: caseStatusEnum("status").notNull().default("new"),
  priority: priorityEnum("priority").default("medium"),
  caseNumber: text("case_number").notNull().unique(), // Auto-generated case number
  timeline: jsonb("timeline"), // Chronological log of all activities
  slaDeadline: timestamp("sla_deadline"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  archived: boolean("archived").default(false), // Archive status
  archivedAt: timestamp("archived_at"), // When the case was archived
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Suppliers table
export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supplierCode: text("supplier_code").notNull().unique(), // Relatiecode
  name: text("name").notNull(), // Naam
  contactPerson: text("contact_person"), // Contactpersoon
  email: text("email"),
  phone: text("phone"), // Telefoon
  mobile: text("mobile"), // Mobiele telefoon
  address: text("address"), // Adres
  postalCode: text("postal_code"), // Postcode
  city: text("city"), // Plaats
  website: text("website"), // Website url
  kvkNumber: text("kvk_number"), // Kvk nummer
  vatNumber: text("vat_number"), // Btw nummer
  iban: text("iban"),
  bic: text("bic"),
  bankAccount: text("bank_account"), // Bankrekeningnummer
  paymentTerms: integer("payment_terms").default(0), // Krediettermijn in days
  correspondenceAddress: text("correspondence_address"), // Correspondentie adres
  correspondencePostalCode: text("correspondence_postal_code"),
  correspondenceCity: text("correspondence_city"),
  correspondenceContact: text("correspondence_contact"),
  notes: text("notes"), // Memo
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Purchase Orders table
export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poNumber: text("po_number").notNull().unique(), // Auto-generated PO number
  title: text("title").notNull(),
  supplierId: varchar("supplier_id").references(() => suppliers.id).notNull(),
  orderDate: timestamp("order_date").notNull(),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  receivedDate: timestamp("received_date"),
  totalAmount: integer("total_amount").notNull(), // in cents
  currency: text("currency").default("EUR"),
  status: purchaseOrderStatusEnum("status").notNull().default("draft"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  assignedBuyer: varchar("assigned_buyer").references(() => users.id),
  receivedBy: varchar("received_by").references(() => users.id),
  caseId: varchar("case_id").references(() => cases.id), // Optional link to case
  orderId: varchar("order_id").references(() => orders.id), // Optional link to order
  notes: text("notes"),
  invoiceUrl: text("invoice_url"), // URL to invoice file
  deliveryNoteUrl: text("delivery_note_url"), // URL to delivery note
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Purchase Order Items table
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseOrderId: varchar("purchase_order_id").references(() => purchaseOrders.id).notNull(),
  sku: text("sku"),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(), // in cents
  subtotal: integer("subtotal").notNull(), // in cents (quantity * unitPrice)
  receivedQuantity: integer("received_quantity").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Activity feed table
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // e.g., 'order_created', 'repair_completed', 'email_replied', 'purchase_order_created'
  description: text("description").notNull(),
  userId: varchar("user_id").references(() => users.id),
  metadata: jsonb("metadata"), // additional data about the activity
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit logs table - for RBAC audit trail
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(), // e.g., 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'
  resource: text("resource").notNull(), // e.g., 'user', 'case', 'repair', 'email'
  resourceId: text("resource_id"), // ID of the affected resource
  details: jsonb("details"), // Additional context about the action
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  success: boolean("success").notNull().default(true),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailThreadSchema = createInsertSchema(emailThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailMessageSchema = createInsertSchema(emailMessages).omit({
  id: true,
  createdAt: true,
});

export const insertRepairSchema = createInsertSchema(repairs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTodoSchema = createInsertSchema(todos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  dueDate: z.string().datetime().optional().or(z.date().optional()).or(z.null()),
});

export const insertInternalNoteSchema = createInsertSchema(internalNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true,
  poNumber: true, // Auto-generated
  createdAt: true,
  updatedAt: true,
}).extend({
  orderDate: z.union([z.string(), z.date()]).transform(val => 
    typeof val === 'string' ? new Date(val) : val
  ),
  expectedDeliveryDate: z.union([z.string(), z.date()]).optional().transform(val => 
    val && typeof val === 'string' ? new Date(val) : val
  ),
  totalAmount: z.number().int().positive(),
});

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCaseSchema = createInsertSchema(cases).omit({
  id: true,
  caseNumber: true, // Auto-generated
  createdAt: true,
  updatedAt: true,
}).extend({
  slaDeadline: z.string().datetime().optional().or(z.date().optional()).or(z.null()),
  resolvedAt: z.string().datetime().optional().or(z.date().optional()).or(z.null()),
  closedAt: z.string().datetime().optional().or(z.date().optional()).or(z.null()),
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertEmailAttachmentSchema = createInsertSchema(emailAttachments).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type EmailThread = typeof emailThreads.$inferSelect;
export type InsertEmailThread = z.infer<typeof insertEmailThreadSchema>;

export type EmailMessage = typeof emailMessages.$inferSelect;
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;

export type Repair = typeof repairs.$inferSelect;
export type InsertRepair = z.infer<typeof insertRepairSchema>;

export type Todo = typeof todos.$inferSelect;
export type InsertTodo = z.infer<typeof insertTodoSchema>;

export type InternalNote = typeof internalNotes.$inferSelect;
export type InsertInternalNote = z.infer<typeof insertInternalNoteSchema>;

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;

export type Case = typeof cases.$inferSelect;
export type InsertCase = z.infer<typeof insertCaseSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type EmailAttachment = typeof emailAttachments.$inferSelect;
export type InsertEmailAttachment = z.infer<typeof insertEmailAttachmentSchema>;

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;
