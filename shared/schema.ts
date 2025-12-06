import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["ADMIN", "SUPPORT", "TECHNICUS"]);
export const priorityEnum = pgEnum("priority", ["low", "medium", "high", "urgent"]);
export const repairStatusEnum = pgEnum("repair_status", ["new", "in_repair", "completed", "returned"]);
export const repairTypeEnum = pgEnum("repair_type", ["customer", "inventory"]);
export const todoStatusEnum = pgEnum("todo_status", ["todo", "in_progress", "done"]);
export const todoCategoryEnum = pgEnum("todo_category", ["orders", "purchasing", "marketing", "admin", "other"]);
export const emailStatusEnum = pgEnum("email_status", ["open", "closed"]);
export const emailFolderEnum = pgEnum("email_folder", ["inbox", "sent"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"]);
export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", ["aangekocht", "ontvangen", "verwerkt"]);
export const caseStatusEnum = pgEnum("case_status", ["new", "in_progress", "waiting_customer", "resolved"]);
export const caseEventTypeEnum = pgEnum("case_event_type", ["created", "status_change", "note_added", "link_added", "link_removed", "sla_set", "assigned", "email_sent", "email_received"]);
export const caseLinkTypeEnum = pgEnum("case_link_type", ["order", "email", "repair", "todo", "return"]);
export const returnStatusEnum = pgEnum("return_status", [
  "nieuw",                  // NEW: Pending approval (Shopify: REQUESTED)
  "onderweg",               // NEW: Approved with label (Shopify: OPEN)
  "nieuw_onderweg",         // DEPRECATED: Keep for migration compatibility
  "ontvangen_controle",
  "akkoord_terugbetaling",
  "vermiste_pakketten",
  "wachten_klant",
  "opnieuw_versturen",
  "klaar",
  "niet_ontvangen"
]);
export const returnReasonEnum = pgEnum("return_reason", ["wrong_item", "damaged", "defective", "size_issue", "changed_mind", "other"]);
export const refundStatusEnum = pgEnum("refund_status", ["pending", "processing", "completed", "failed"]);
export const refundMethodEnum = pgEnum("refund_method", ["original_payment", "store_credit", "exchange"]);

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
  orderDate: timestamp("order_date"), // Actual order date from Shopify
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
  folder: emailFolderEnum("folder").notNull().default("inbox"),
  starred: boolean("starred").default(false),
  archived: boolean("archived").default(false),
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
  uid: integer("uid"), // IMAP UID for on-demand fetching
  threadId: varchar("thread_id").references(() => emailThreads.id).notNull(),
  fromEmail: text("from_email").notNull(),
  toEmail: text("to_email").notNull(),
  subject: text("subject"),
  isHtml: boolean("is_html").default(false),
  isOutbound: boolean("is_outbound").default(false),
  folder: emailFolderEnum("folder").notNull().default("inbox"),
  attachments: jsonb("attachments"), // array of attachment metadata
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Repairs table
export const repairs = pgTable("repairs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  productSku: text("product_sku"),
  productName: text("product_name"),
  issueCategory: text("issue_category"),
  customerName: text("customer_name"), // Direct customer name for display
  customerEmail: text("customer_email"), // Direct customer email for display
  orderNumber: text("order_number"), // Direct order number for display
  customerId: varchar("customer_id").references(() => customers.id),
  orderId: varchar("order_id").references(() => orders.id),
  emailThreadId: varchar("email_thread_id").references(() => emailThreads.id),
  assignedUserId: varchar("assigned_user_id").references(() => users.id),
  status: repairStatusEnum("status").notNull().default("new"),
  priority: priorityEnum("priority").default("medium"),
  estimatedCost: integer("estimated_cost"), // in cents
  actualCost: integer("actual_cost"), // in cents
  partsNeeded: text("parts_needed").array(),
  partsUsed: jsonb("parts_used"), // array of {name, cost, quantity}
  photos: text("photos").array(), // URLs to stored photos
  attachments: text("attachments").array(), // URLs to other file attachments
  timeline: jsonb("timeline"), // array of status updates
  slaDeadline: timestamp("sla_deadline"),
  completedAt: timestamp("completed_at"),
  returnedAt: timestamp("returned_at"),
  repairType: repairTypeEnum("repair_type").notNull().default("customer"), // customer or inventory
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
  caseId: varchar("case_id").references(() => cases.id), // Link todos to cases
  returnId: varchar("return_id").references(() => returns.id), // Link todos to returns
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
  caseId: varchar("case_id").references(() => cases.id), // Link notes to cases
  returnId: varchar("return_id").references(() => returns.id), // Link notes to returns
  mentions: text("mentions").array(), // user IDs mentioned in the note
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Cases table - Central overarching object for customer requests
export const cases = pgTable("cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  customerId: varchar("customer_id").references(() => customers.id),
  customerEmail: text("customer_email"),
  orderId: varchar("order_id").references(() => orders.id), // Primary order link
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

// Case Links table - Links cases to related entities
export const caseLinks = pgTable("case_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => cases.id).notNull(),
  linkType: caseLinkTypeEnum("link_type").notNull(),
  linkedId: varchar("linked_id").notNull(), // ID of the linked entity (order, email, repair, or todo)
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Case Notes table - Internal notes for cases
export const caseNotes = pgTable("case_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => cases.id).notNull(),
  content: text("content").notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Case Events table - Timeline of all case activities
export const caseEvents = pgTable("case_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => cases.id).notNull(),
  eventType: caseEventTypeEnum("event_type").notNull(),
  message: text("message").notNull(), // Description of what happened
  metadata: jsonb("metadata"), // Additional context (e.g., old/new values for status changes)
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Case Items table - Specific items from linked order with notes
export const caseItems = pgTable("case_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => cases.id, { onDelete: "cascade" }).notNull(),

  sku: text("sku"),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price"), // in cents
  imageUrl: text("image_url"),
  notes: text("notes"), // User-entered notes like "camera broken", "didn't arrive"

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// System Settings table - for tracking system-wide configurations like last sync times
export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
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
  supplierNumber: text("supplier_number").notNull(), // Supplier's reference number
  supplierId: varchar("supplier_id").references(() => suppliers.id).notNull(),
  orderDate: timestamp("order_date").notNull(),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  receivedDate: timestamp("received_date"),
  totalAmount: integer("total_amount").notNull(), // in cents
  currency: text("currency").default("EUR"),
  status: purchaseOrderStatusEnum("status").notNull().default("aangekocht"),
  isPaid: boolean("is_paid").notNull().default(false), // Payment status
  archived: boolean("archived").notNull().default(false), // Archive status
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

// Purchase Order Files table
export const purchaseOrderFiles = pgTable("purchase_order_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseOrderId: varchar("purchase_order_id").references(() => purchaseOrders.id, { onDelete: "cascade" }).notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(), // Object storage path
  fileType: text("file_type").notNull(), // MIME type
  fileSize: integer("file_size").notNull(), // Size in bytes
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Returns table - Product returns management
export const returns = pgTable("returns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  returnNumber: text("return_number").notNull().unique(), // Auto-generated (e.g., RET-2025-001)

  // Relationships
  customerId: varchar("customer_id").references(() => customers.id),
  orderId: varchar("order_id").references(() => orders.id),
  caseId: varchar("case_id").references(() => cases.id),
  assignedUserId: varchar("assigned_user_id").references(() => users.id),

  // Return details
  status: returnStatusEnum("status").notNull().default("nieuw"),
  returnReason: returnReasonEnum("return_reason"),
  otherReason: text("other_reason"), // Custom reason when returnReason is "other"
  trackingNumber: text("tracking_number"),

  // Dates
  requestedAt: timestamp("requested_at").defaultNow(),
  receivedAt: timestamp("received_at"),
  expectedReturnDate: timestamp("expected_return_date"),
  completedAt: timestamp("completed_at"),

  // Financial (amounts in cents)
  refundAmount: integer("refund_amount"),
  refundStatus: refundStatusEnum("refund_status").default("pending"),
  refundMethod: refundMethodEnum("refund_method"),
  shopifyRefundId: text("shopify_refund_id"),

  // Shopify Integration
  shopifyReturnId: text("shopify_return_id").unique(), // Shopify's gid://shopify/Return/...
  shopifyReturnName: text("shopify_return_name"), // e.g., #1001-R1
  syncedAt: timestamp("synced_at"), // Last sync from Shopify

  // Notes & evidence
  customerNotes: text("customer_notes"),
  internalNotes: text("internal_notes"),
  conditionNotes: text("condition_notes"), // Notes after inspection
  photos: text("photos").array(), // Array of object storage URLs

  // Metadata
  priority: priorityEnum("priority").default("medium"),
  tags: text("tags").array(),
  isArchived: boolean("is_archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Return Items table - Individual products in a return
export const returnItems = pgTable("return_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  returnId: varchar("return_id").references(() => returns.id).notNull(),

  sku: text("sku"),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price"), // in cents
  condition: text("condition"), // unopened, opened_unused, used, damaged
  imageUrl: text("image_url"), // from Shopify or object storage

  restockable: boolean("restockable").default(false),
  restockedAt: timestamp("restocked_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// NOTES DOMAIN - Advanced Notes System
// ============================================

export const noteVisibilityEnum = pgEnum("note_visibility", ["internal", "customer_visible", "system"]);
export const noteEntityTypeEnum = pgEnum("note_entity_type", ["customer", "order", "repair", "emailThread", "case", "return", "purchaseOrder", "todo"]);
export const noteLinkTypeEnum = pgEnum("note_link_type", ["order", "tracking", "sku", "email", "url"]);
export const followupStatusEnum = pgEnum("followup_status", ["pending", "in_progress", "completed", "cancelled"]);

// Main polymorphic Notes table
export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Polymorphic entity linking
  entityType: noteEntityTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),

  // Note visibility (who can see it)
  visibility: noteVisibilityEnum("visibility").notNull().default("internal"),

  // Content
  content: text("content").notNull(), // Rich text HTML
  renderedHtml: text("rendered_html"), // Sanitized HTML
  plainText: text("plain_text"), // For search

  // Threading (enforced max depth via application logic)
  parentNoteId: varchar("parent_note_id").references((): any => notes.id),
  threadDepth: integer("thread_depth").default(0).$type<number>(),

  // Author & timestamps
  authorId: varchar("author_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  editedAt: timestamp("edited_at"),

  // Pinning (max 3 enforced via application logic)
  isPinned: boolean("is_pinned").default(false),
  pinnedAt: timestamp("pinned_at"),
  pinnedBy: varchar("pinned_by").references(() => users.id),

  // Soft delete
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by").references(() => users.id),
  deleteReason: text("delete_reason"),

  // Status context
  statusPromptId: varchar("status_prompt_id"),

  // Source tracking
  source: text("source").default("manual"), // manual, email, system
});

// Note Tags catalog
export const noteTags = pgTable("note_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  color: text("color"), // hex color for display
  createdAt: timestamp("created_at").defaultNow(),
});

// Note-Tag assignments (many-to-many)
export const noteTagAssignments = pgTable("note_tag_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: varchar("note_id").references(() => notes.id, { onDelete: "cascade" }).notNull(),
  tagId: varchar("tag_id").references(() => noteTags.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Note Mentions
export const noteMentions = pgTable("note_mentions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: varchar("note_id").references(() => notes.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  notified: boolean("notified").default(false),
  notifiedAt: timestamp("notified_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Note Reactions
export const noteReactions = pgTable("note_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: varchar("note_id").references(() => notes.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  emoji: text("emoji").notNull(), // 👍 👀 ✅
  createdAt: timestamp("created_at").defaultNow(),
});

// Note Attachments
export const noteAttachments = pgTable("note_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: varchar("note_id").references(() => notes.id, { onDelete: "cascade" }).notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(), // Object storage path
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  previewUrl: text("preview_url"), // For images
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Note Follow-ups (integrates with Todos)
export const noteFollowups = pgTable("note_followups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: varchar("note_id").references(() => notes.id, { onDelete: "cascade" }).notNull(),
  todoId: varchar("todo_id").references(() => todos.id), // Optional link to unified tasks
  dueAt: timestamp("due_at").notNull(),
  assigneeId: varchar("assignee_id").references(() => users.id).notNull(),
  status: followupStatusEnum("status").default("pending"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Note Revisions (audit trail for edits)
export const noteRevisions = pgTable("note_revisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: varchar("note_id").references(() => notes.id, { onDelete: "cascade" }).notNull(),
  editorId: varchar("editor_id").references(() => users.id).notNull(),
  previousContent: text("previous_content").notNull(),
  newContent: text("new_content").notNull(),
  delta: jsonb("delta"), // Change diff
  editedAt: timestamp("edited_at").defaultNow(),
});

// Note Templates
export const noteTemplates = pgTable("note_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  content: text("content").notNull(), // Template with {{variables}}
  description: text("description"),
  scope: text("scope").default("global"), // global, status-specific, entityType
  entityType: noteEntityTypeEnum("entity_type"),
  statusContext: text("status_context"), // e.g., waiting_customer, missing_package
  variables: text("variables").array(), // e.g., [orderId, customerFirstName]
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Note Links (smart links to other entities)
export const noteLinks = pgTable("note_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: varchar("note_id").references(() => notes.id, { onDelete: "cascade" }).notNull(),
  linkType: noteLinkTypeEnum("link_type").notNull(),
  targetId: text("target_id"), // Order ID, tracking number, SKU, etc.
  displayText: text("display_text"),
  url: text("url"),
  createdAt: timestamp("created_at").defaultNow(),
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
  receivedDate: z.union([z.string(), z.date()]).optional().nullable().transform(val =>
    val && typeof val === 'string' ? new Date(val) : val
  ),
  totalAmount: z.number().int().nonnegative(),
  archived: z.boolean().optional(), // Allow archiving via updates
});

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseOrderFileSchema = createInsertSchema(purchaseOrderFiles).omit({
  id: true,
  uploadedAt: true,
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

export const insertCaseLinkSchema = createInsertSchema(caseLinks).omit({
  id: true,
  createdAt: true,
});

export const insertCaseNoteSchema = createInsertSchema(caseNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCaseEventSchema = createInsertSchema(caseEvents).omit({
  id: true,
  createdAt: true,
});

export const insertCaseItemSchema = createInsertSchema(caseItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});



export const insertReturnSchema = createInsertSchema(returns).omit({
  id: true,
  returnNumber: true, // Auto-generated
  createdAt: true,
  updatedAt: true,
}).extend({
  requestedAt: z.union([z.string(), z.date()]).optional().transform(val =>
    val && typeof val === 'string' ? new Date(val) : val
  ),
  receivedAt: z.union([z.string(), z.date()]).optional().nullable().transform(val =>
    val && typeof val === 'string' ? new Date(val) : val
  ),
  expectedReturnDate: z.union([z.string(), z.date()]).optional().nullable().transform(val =>
    val && typeof val === 'string' ? new Date(val) : val
  ),
  completedAt: z.union([z.string(), z.date()]).optional().nullable().transform(val =>
    val && typeof val === 'string' ? new Date(val) : val
  ),
});

export const insertReturnItemSchema = createInsertSchema(returnItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Notes Domain Insert Schemas
export const insertNoteSchema = createInsertSchema(notes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  editedAt: true,
  pinnedAt: true,
  deletedAt: true,
});

export const insertNoteTagSchema = createInsertSchema(noteTags).omit({
  id: true,
  createdAt: true,
});

export const insertNoteTagAssignmentSchema = createInsertSchema(noteTagAssignments).omit({
  id: true,
  createdAt: true,
});

export const insertNoteMentionSchema = createInsertSchema(noteMentions).omit({
  id: true,
  createdAt: true,
  notifiedAt: true,
});

export const insertNoteReactionSchema = createInsertSchema(noteReactions).omit({
  id: true,
  createdAt: true,
});

export const insertNoteAttachmentSchema = createInsertSchema(noteAttachments).omit({
  id: true,
  uploadedAt: true,
});

export const insertNoteFollowupSchema = createInsertSchema(noteFollowups).omit({
  id: true,
  createdAt: true,
  completedAt: true,
}).extend({
  dueAt: z.union([z.string(), z.date()]).transform(val =>
    typeof val === 'string' ? new Date(val) : val
  ),
});

export const insertNoteRevisionSchema = createInsertSchema(noteRevisions).omit({
  id: true,
  editedAt: true,
});

export const insertNoteTemplateSchema = createInsertSchema(noteTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNoteLinkSchema = createInsertSchema(noteLinks).omit({
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

export type CaseLink = typeof caseLinks.$inferSelect;
export type InsertCaseLink = z.infer<typeof insertCaseLinkSchema>;

export type CaseNote = typeof caseNotes.$inferSelect;
export type InsertCaseNote = z.infer<typeof insertCaseNoteSchema>;

export type CaseEvent = typeof caseEvents.$inferSelect;
export type InsertCaseEvent = z.infer<typeof insertCaseEventSchema>;

export type CaseItem = typeof caseItems.$inferSelect;
export type InsertCaseItem = z.infer<typeof insertCaseItemSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;



export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;

export type PurchaseOrderFile = typeof purchaseOrderFiles.$inferSelect;
export type InsertPurchaseOrderFile = z.infer<typeof insertPurchaseOrderFileSchema>;

export type Return = typeof returns.$inferSelect;
export type InsertReturn = z.infer<typeof insertReturnSchema>;

export type ReturnItem = typeof returnItems.$inferSelect;
export type InsertReturnItem = z.infer<typeof insertReturnItemSchema>;

// Notes Domain Types
export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;

export type NoteTag = typeof noteTags.$inferSelect;
export type InsertNoteTag = z.infer<typeof insertNoteTagSchema>;

export type NoteTagAssignment = typeof noteTagAssignments.$inferSelect;
export type InsertNoteTagAssignment = z.infer<typeof insertNoteTagAssignmentSchema>;

export type NoteMention = typeof noteMentions.$inferSelect;
export type InsertNoteMention = z.infer<typeof insertNoteMentionSchema>;

export type NoteReaction = typeof noteReactions.$inferSelect;
export type InsertNoteReaction = z.infer<typeof insertNoteReactionSchema>;

export type NoteAttachment = typeof noteAttachments.$inferSelect;
export type InsertNoteAttachment = z.infer<typeof insertNoteAttachmentSchema>;

export type NoteFollowup = typeof noteFollowups.$inferSelect;
export type InsertNoteFollowup = z.infer<typeof insertNoteFollowupSchema>;

export type NoteRevision = typeof noteRevisions.$inferSelect;
export type InsertNoteRevision = z.infer<typeof insertNoteRevisionSchema>;

export type NoteTemplate = typeof noteTemplates.$inferSelect;
export type InsertNoteTemplate = z.infer<typeof insertNoteTemplateSchema>;

export type NoteLink = typeof noteLinks.$inferSelect;
export type InsertNoteLink = z.infer<typeof insertNoteLinkSchema>;

// ============================================
// TODO SUBTASKS & ATTACHMENTS
// ============================================

export const subtasks = pgTable("subtasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  todoId: varchar("todo_id").notNull(),
  title: text("title").notNull(),
  completed: boolean("completed").default(false),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const todoAttachments = pgTable("todo_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  todoId: varchar("todo_id").notNull(),
  filename: text("filename").notNull(),
  storageUrl: text("storage_url").notNull(),
  contentType: text("content_type"),
  size: integer("size"),
  uploadedBy: varchar("uploaded_by"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Zod schemas
export const insertSubtaskSchema = createInsertSchema(subtasks);
export const insertTodoAttachmentSchema = createInsertSchema(todoAttachments);

// TypeScript types
export type Subtask = typeof subtasks.$inferSelect;
export type InsertSubtask = z.infer<typeof insertSubtaskSchema>;

export type TodoAttachment = typeof todoAttachments.$inferSelect;
export type InsertTodoAttachment = z.infer<typeof insertTodoAttachmentSchema>;

// ============================================
// EMAIL METADATA (SnappyMail Integration)
// ============================================

// Email metadata table for linking emails to ThriftHub entities
// Email content stays on Strato IMAP - only metadata is stored
export const emailMetadata = pgTable("email_metadata", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // IMAP identifiers (from SnappyMail)
  messageId: varchar("message_id", { length: 255 }).notNull().unique(),
  threadId: varchar("thread_id", { length: 255 }),

  // ThriftHub entity links
  caseId: varchar("case_id", { length: 50 }).references(() => cases.id, { onDelete: "set null" }),
  orderId: varchar("order_id", { length: 50 }).references(() => orders.id, { onDelete: "set null" }),
  returnId: varchar("return_id", { length: 50 }).references(() => returns.id, { onDelete: "set null" }),
  repairId: varchar("repair_id", { length: 50 }).references(() => repairs.id, { onDelete: "set null" }),

  // Metadata
  linkedBy: varchar("linked_by", { length: 50 }).references(() => users.id, { onDelete: "set null" }),
  linkedAt: timestamp("linked_at").defaultNow(),

  // Optional: Subject for search (NOT full body)
  subject: text("subject"),
  fromEmail: varchar("from_email", { length: 255 }),
  toEmail: varchar("to_email", { length: 255 }),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Zod schema
export const insertEmailMetadataSchema = createInsertSchema(emailMetadata);

// TypeScript types
export type EmailMetadata = typeof emailMetadata.$inferSelect;
export type InsertEmailMetadata = z.infer<typeof insertEmailMetadataSchema>;

// ====================================
// MAIL SYSTEM (New Architecture)
// ====================================

// Entity type enum for polymorphic links
export const emailEntityTypeEnum = pgEnum("email_entity_type", ["order", "case", "return", "repair"]);

// Emails table - stores last 50 emails
export const emails = pgTable("emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subject: text("subject"),
  fromName: text("from_name"),
  fromEmail: text("from_email"),
  html: text("html"),
  text: text("text"),
  date: timestamp("date"),
  imapUid: integer("imap_uid").unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod schema
export const insertEmailSchema = createInsertSchema(emails);

// TypeScript types
export type Email = typeof emails.$inferSelect;
export type InsertEmail = z.infer<typeof insertEmailSchema>;

// Email attachments table
export const emailAttachments = pgTable("email_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailId: varchar("email_id").notNull().references(() => emails.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mimeType: text("mime_type"),
  size: integer("size"),
  storagePath: text("storage_path").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod schema
export const insertEmailAttachmentSchema = createInsertSchema(emailAttachments);

// TypeScript types
export type EmailAttachment = typeof emailAttachments.$inferSelect;
export type InsertEmailAttachment = z.infer<typeof insertEmailAttachmentSchema>;

// Email links table - polymorphic links to entities
export const emailLinks = pgTable("email_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailId: varchar("email_id").notNull().references(() => emails.id, { onDelete: "cascade" }),
  entityType: emailEntityTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod schema
export const insertEmailLinkSchema = createInsertSchema(emailLinks);

// TypeScript types
export type EmailLink = typeof emailLinks.$inferSelect;
export type InsertEmailLink = z.infer<typeof insertEmailLinkSchema>;
