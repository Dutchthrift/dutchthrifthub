CREATE TYPE "public"."case_event_type" AS ENUM('created', 'status_change', 'note_added', 'link_added', 'link_removed', 'sla_set', 'assigned', 'email_sent', 'email_received');--> statement-breakpoint
CREATE TYPE "public"."case_link_type" AS ENUM('order', 'email', 'repair', 'todo', 'return');--> statement-breakpoint
CREATE TYPE "public"."email_entity_type" AS ENUM('order', 'case', 'return', 'repair');--> statement-breakpoint
CREATE TYPE "public"."email_folder" AS ENUM('inbox', 'sent');--> statement-breakpoint
CREATE TYPE "public"."followup_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."inventory_repair_status" AS ENUM('purchased', 'diagnosing', 'waiting_parts', 'repair_in_progress', 'tested', 'ready_for_sale', 'sold');--> statement-breakpoint
CREATE TYPE "public"."note_entity_type" AS ENUM('customer', 'order', 'repair', 'emailThread', 'case', 'return', 'purchaseOrder', 'todo');--> statement-breakpoint
CREATE TYPE "public"."note_link_type" AS ENUM('order', 'tracking', 'sku', 'email', 'url');--> statement-breakpoint
CREATE TYPE "public"."note_visibility" AS ENUM('internal', 'customer_visible', 'system');--> statement-breakpoint
CREATE TYPE "public"."refund_method" AS ENUM('original_payment', 'store_credit', 'exchange');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."repair_type" AS ENUM('customer', 'inventory');--> statement-breakpoint
CREATE TYPE "public"."return_reason" AS ENUM('wrong_item', 'damaged', 'defective', 'size_issue', 'changed_mind', 'other');--> statement-breakpoint
CREATE TYPE "public"."return_status" AS ENUM('nieuw', 'onderweg', 'nieuw_onderweg', 'ontvangen_controle', 'akkoord_terugbetaling', 'vermiste_pakketten', 'wachten_klant', 'opnieuw_versturen', 'klaar', 'niet_ontvangen');--> statement-breakpoint
CREATE TYPE "public"."todo_category" AS ENUM('orders', 'purchasing', 'marketing', 'admin', 'other');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" text,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "case_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar NOT NULL,
	"event_type" "case_event_type" NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "case_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar NOT NULL,
	"sku" text,
	"product_name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" integer,
	"image_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "case_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar NOT NULL,
	"link_type" "case_link_type" NOT NULL,
	"linked_id" varchar NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "case_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_id" varchar NOT NULL,
	"entity_type" "email_entity_type" NOT NULL,
	"entity_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_metadata" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar(255) NOT NULL,
	"thread_id" varchar(255),
	"case_id" varchar(50),
	"order_id" varchar(50),
	"return_id" varchar(50),
	"repair_id" varchar(50),
	"linked_by" varchar(50),
	"linked_at" timestamp DEFAULT now(),
	"subject" text,
	"from_email" varchar(255),
	"to_email" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "email_metadata_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text,
	"from_name" text,
	"from_email" text,
	"html" text,
	"text" text,
	"date" timestamp,
	"imap_uid" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "emails_imap_uid_unique" UNIQUE("imap_uid")
);
--> statement-breakpoint
CREATE TABLE "note_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" varchar NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"preview_url" text,
	"uploaded_by" varchar,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "note_followups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" varchar NOT NULL,
	"todo_id" varchar,
	"due_at" timestamp NOT NULL,
	"assignee_id" varchar NOT NULL,
	"status" "followup_status" DEFAULT 'pending',
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "note_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" varchar NOT NULL,
	"link_type" "note_link_type" NOT NULL,
	"target_id" text,
	"display_text" text,
	"url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "note_mentions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"notified" boolean DEFAULT false,
	"notified_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "note_reactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "note_revisions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" varchar NOT NULL,
	"editor_id" varchar NOT NULL,
	"previous_content" text NOT NULL,
	"new_content" text NOT NULL,
	"delta" jsonb,
	"edited_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "note_tag_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" varchar NOT NULL,
	"tag_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "note_tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "note_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "note_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"description" text,
	"scope" text DEFAULT 'global',
	"entity_type" "note_entity_type",
	"status_context" text,
	"variables" text[],
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "note_entity_type" NOT NULL,
	"entity_id" varchar NOT NULL,
	"visibility" "note_visibility" DEFAULT 'internal' NOT NULL,
	"content" text NOT NULL,
	"rendered_html" text,
	"plain_text" text,
	"parent_note_id" varchar,
	"thread_depth" integer DEFAULT 0,
	"author_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"edited_at" timestamp,
	"is_pinned" boolean DEFAULT false,
	"pinned_at" timestamp,
	"pinned_by" varchar,
	"deleted_at" timestamp,
	"deleted_by" varchar,
	"delete_reason" text,
	"status_prompt_id" varchar,
	"source" text DEFAULT 'manual'
);
--> statement-breakpoint
CREATE TABLE "purchase_order_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" varchar NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"uploaded_by" varchar,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" varchar NOT NULL,
	"sku" text,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"subtotal" integer NOT NULL,
	"received_quantity" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "return_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" varchar NOT NULL,
	"sku" text,
	"product_name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" integer,
	"condition" text,
	"image_url" text,
	"restockable" boolean DEFAULT false,
	"restocked_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_number" text NOT NULL,
	"customer_id" varchar,
	"order_id" varchar,
	"case_id" varchar,
	"assigned_user_id" varchar,
	"status" "return_status" DEFAULT 'nieuw' NOT NULL,
	"return_reason" "return_reason",
	"other_reason" text,
	"tracking_number" text,
	"requested_at" timestamp DEFAULT now(),
	"received_at" timestamp,
	"expected_return_date" timestamp,
	"completed_at" timestamp,
	"refund_amount" integer,
	"refund_status" "refund_status" DEFAULT 'pending',
	"refund_method" "refund_method",
	"shopify_refund_id" text,
	"shopify_return_id" text,
	"shopify_return_name" text,
	"synced_at" timestamp,
	"customer_notes" text,
	"internal_notes" text,
	"condition_notes" text,
	"photos" text[],
	"priority" "priority" DEFAULT 'medium',
	"tags" text[],
	"is_archived" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "returns_return_number_unique" UNIQUE("return_number"),
	CONSTRAINT "returns_shopify_return_id_unique" UNIQUE("shopify_return_id")
);
--> statement-breakpoint
CREATE TABLE "subtasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"todo_id" varchar NOT NULL,
	"title" text NOT NULL,
	"completed" boolean DEFAULT false,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_code" text NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"email" text,
	"phone" text,
	"mobile" text,
	"address" text,
	"postal_code" text,
	"city" text,
	"website" text,
	"kvk_number" text,
	"vat_number" text,
	"iban" text,
	"bic" text,
	"bank_account" text,
	"payment_terms" integer DEFAULT 0,
	"correspondence_address" text,
	"correspondence_postal_code" text,
	"correspondence_city" text,
	"correspondence_contact" text,
	"notes" text,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "suppliers_supplier_code_unique" UNIQUE("supplier_code")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "todo_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"todo_id" varchar NOT NULL,
	"filename" text NOT NULL,
	"storage_url" text NOT NULL,
	"content_type" text,
	"size" integer,
	"uploaded_by" varchar,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "email_attachments" DROP CONSTRAINT "email_attachments_message_id_email_messages_id_fk";
--> statement-breakpoint
ALTER TABLE "internal_notes" DROP CONSTRAINT "internal_notes_email_thread_id_email_threads_id_fk";
--> statement-breakpoint
ALTER TABLE "todos" DROP CONSTRAINT "todos_email_thread_id_email_threads_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "status" SET DEFAULT 'aangekocht';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'SUPPORT';--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "order_id" varchar;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD COLUMN "email_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD COLUMN "mime_type" text;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD COLUMN "storage_path" text NOT NULL;--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "uid" integer;--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "folder" "email_folder" DEFAULT 'inbox' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_threads" ADD COLUMN "folder" "email_folder" DEFAULT 'inbox' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_threads" ADD COLUMN "starred" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "email_threads" ADD COLUMN "archived" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "internal_notes" ADD COLUMN "return_id" varchar;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "order_date" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "po_number" text NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "supplier_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "order_date" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "expected_delivery_date" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "received_date" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "total_amount" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "is_paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "created_by" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "assigned_buyer" varchar;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "received_by" varchar;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "case_id" varchar;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "order_id" varchar;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "invoice_url" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "delivery_note_url" text;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "product_sku" text;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "product_name" text;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "issue_category" text;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "customer_name" text;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "customer_email" text;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "order_number" text;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "parts_used" jsonb;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "attachments" text[];--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "returned_at" timestamp;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "repair_type" "repair_type" DEFAULT 'customer' NOT NULL;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "inventory_status" "inventory_repair_status";--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "purchase_source" text;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "purchase_price" integer;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "purchase_date" timestamp;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "serial_number" text;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "brand_model" text;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "estimated_sale_price" integer;--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "category" "todo_category" DEFAULT 'other';--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "created_by" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "return_id" varchar;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_items" ADD CONSTRAINT "case_items_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_links" ADD CONSTRAINT "case_links_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_links" ADD CONSTRAINT "case_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_links" ADD CONSTRAINT "email_links_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_metadata" ADD CONSTRAINT "email_metadata_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_metadata" ADD CONSTRAINT "email_metadata_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_metadata" ADD CONSTRAINT "email_metadata_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."returns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_metadata" ADD CONSTRAINT "email_metadata_repair_id_repairs_id_fk" FOREIGN KEY ("repair_id") REFERENCES "public"."repairs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_metadata" ADD CONSTRAINT "email_metadata_linked_by_users_id_fk" FOREIGN KEY ("linked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_attachments" ADD CONSTRAINT "note_attachments_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_attachments" ADD CONSTRAINT "note_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_followups" ADD CONSTRAINT "note_followups_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_followups" ADD CONSTRAINT "note_followups_todo_id_todos_id_fk" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_followups" ADD CONSTRAINT "note_followups_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_links" ADD CONSTRAINT "note_links_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_mentions" ADD CONSTRAINT "note_mentions_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_mentions" ADD CONSTRAINT "note_mentions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_reactions" ADD CONSTRAINT "note_reactions_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_reactions" ADD CONSTRAINT "note_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_revisions" ADD CONSTRAINT "note_revisions_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_revisions" ADD CONSTRAINT "note_revisions_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_tag_assignments" ADD CONSTRAINT "note_tag_assignments_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_tag_assignments" ADD CONSTRAINT "note_tag_assignments_tag_id_note_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."note_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_templates" ADD CONSTRAINT "note_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_parent_note_id_notes_id_fk" FOREIGN KEY ("parent_note_id") REFERENCES "public"."notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_pinned_by_users_id_fk" FOREIGN KEY ("pinned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_files" ADD CONSTRAINT "purchase_order_files_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_files" ADD CONSTRAINT "purchase_order_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."returns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."returns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_assigned_buyer_users_id_fk" FOREIGN KEY ("assigned_buyer") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."returns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_attachments" DROP COLUMN "message_id";--> statement-breakpoint
ALTER TABLE "email_attachments" DROP COLUMN "content_type";--> statement-breakpoint
ALTER TABLE "email_attachments" DROP COLUMN "storage_url";--> statement-breakpoint
ALTER TABLE "email_attachments" DROP COLUMN "content_id";--> statement-breakpoint
ALTER TABLE "email_attachments" DROP COLUMN "is_inline";--> statement-breakpoint
ALTER TABLE "email_messages" DROP COLUMN "body";--> statement-breakpoint
ALTER TABLE "email_messages" DROP COLUMN "raw_data";--> statement-breakpoint
ALTER TABLE "internal_notes" DROP COLUMN "email_thread_id";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN "supplier_name";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN "purchase_date";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN "amount";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN "photos";--> statement-breakpoint
ALTER TABLE "todos" DROP COLUMN "email_thread_id";--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number");--> statement-breakpoint
ALTER TABLE "public"."cases" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."case_status";--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('new', 'in_progress', 'waiting_customer', 'resolved');--> statement-breakpoint
ALTER TABLE "public"."cases" ALTER COLUMN "status" SET DATA TYPE "public"."case_status" USING "status"::"public"."case_status";--> statement-breakpoint
ALTER TABLE "public"."email_threads" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."email_status";--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('open', 'closed');--> statement-breakpoint
ALTER TABLE "public"."email_threads" ALTER COLUMN "status" SET DATA TYPE "public"."email_status" USING "status"::"public"."email_status";--> statement-breakpoint
ALTER TABLE "public"."purchase_orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."purchase_order_status";--> statement-breakpoint
CREATE TYPE "public"."purchase_order_status" AS ENUM('aangekocht', 'ontvangen', 'verwerkt');--> statement-breakpoint
ALTER TABLE "public"."purchase_orders" ALTER COLUMN "status" SET DATA TYPE "public"."purchase_order_status" USING "status"::"public"."purchase_order_status";--> statement-breakpoint
ALTER TABLE "public"."repairs" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."repair_status";--> statement-breakpoint
CREATE TYPE "public"."repair_status" AS ENUM('new', 'diagnosing', 'waiting_parts', 'repair_in_progress', 'quality_check', 'completed', 'returned', 'canceled');--> statement-breakpoint
ALTER TABLE "public"."repairs" ALTER COLUMN "status" SET DATA TYPE "public"."repair_status" USING "status"::"public"."repair_status";--> statement-breakpoint
ALTER TABLE "public"."users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."user_role";--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'SUPPORT', 'TECHNICUS');--> statement-breakpoint
ALTER TABLE "public"."users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";