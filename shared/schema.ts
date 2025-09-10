import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "agent", "repair_tech", "viewer"]);
export const priorityEnum = pgEnum("priority", ["low", "medium", "high", "urgent"]);
export const repairStatusEnum = pgEnum("repair_status", ["new", "in_progress", "waiting_customer", "waiting_part", "ready", "closed"]);
export const todoStatusEnum = pgEnum("todo_status", ["todo", "in_progress", "done"]);
export const emailStatusEnum = pgEnum("email_status", ["open", "closed", "archived"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"]);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default("agent"),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Todos table
export const todos = pgTable("todos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  assignedUserId: varchar("assigned_user_id").references(() => users.id).notNull(),
  status: todoStatusEnum("status").notNull().default("todo"),
  priority: priorityEnum("priority").default("medium"),
  dueDate: timestamp("due_date"),
  // Linkable to various entities
  customerId: varchar("customer_id").references(() => customers.id),
  orderId: varchar("order_id").references(() => orders.id),
  repairId: varchar("repair_id").references(() => repairs.id),
  emailThreadId: varchar("email_thread_id").references(() => emailThreads.id),
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
  mentions: text("mentions").array(), // user IDs mentioned in the note
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Activity feed table
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // e.g., 'order_created', 'repair_completed', 'email_replied'
  description: text("description").notNull(),
  userId: varchar("user_id").references(() => users.id),
  metadata: jsonb("metadata"), // additional data about the activity
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

export const insertActivitySchema = createInsertSchema(activities).omit({
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

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
