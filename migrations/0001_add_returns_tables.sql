-- Create return-related enums
DO $$ BEGIN
 CREATE TYPE "public"."return_status" AS ENUM('nieuw_onderweg', 'ontvangen_controle', 'akkoord_terugbetaling', 'vermiste_pakketten', 'wachten_klant', 'opnieuw_versturen', 'klaar', 'niet_ontvangen');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."return_reason" AS ENUM('wrong_item', 'damaged', 'defective', 'size_issue', 'changed_mind', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."refund_status" AS ENUM('pending', 'processing', 'completed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."refund_method" AS ENUM('original_payment', 'store_credit', 'exchange');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Update case_link_type enum to include 'return'
ALTER TYPE "public"."case_link_type" ADD VALUE IF NOT EXISTS 'return';

-- Create returns table
CREATE TABLE IF NOT EXISTS "returns" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "return_number" text NOT NULL UNIQUE,
  "customer_id" varchar,
  "order_id" varchar,
  "case_id" varchar,
  "assigned_user_id" varchar,
  "status" "return_status" NOT NULL DEFAULT 'nieuw_onderweg',
  "return_reason" "return_reason",
  "tracking_number" text,
  "requested_at" timestamp DEFAULT now(),
  "received_at" timestamp,
  "expected_return_date" timestamp,
  "completed_at" timestamp,
  "refund_amount" integer,
  "refund_status" "refund_status" DEFAULT 'pending',
  "refund_method" "refund_method",
  "shopify_refund_id" text,
  "customer_notes" text,
  "internal_notes" text,
  "condition_notes" text,
  "photos" text[],
  "priority" "priority" DEFAULT 'medium',
  "tags" text[],
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create return_items table
CREATE TABLE IF NOT EXISTS "return_items" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "return_id" varchar NOT NULL,
  "sku" text,
  "product_name" text NOT NULL,
  "quantity" integer NOT NULL DEFAULT 1,
  "unit_price" integer,
  "condition" text,
  "image_url" text,
  "restockable" boolean DEFAULT false,
  "restocked_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Add foreign key constraints for returns table
DO $$ BEGIN
 ALTER TABLE "returns" ADD CONSTRAINT "returns_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "returns" ADD CONSTRAINT "returns_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "returns" ADD CONSTRAINT "returns_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add foreign key constraint for return_items table
DO $$ BEGIN
 ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."returns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add returnId column to todos table
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "return_id" varchar;

DO $$ BEGIN
 ALTER TABLE "todos" ADD CONSTRAINT "todos_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."returns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add returnId column to internal_notes table
ALTER TABLE "internal_notes" ADD COLUMN IF NOT EXISTS "return_id" varchar;

DO $$ BEGIN
 ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."returns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_returns_return_number" ON "returns" ("return_number");
CREATE INDEX IF NOT EXISTS "idx_returns_customer_status" ON "returns" ("customer_id", "status");
CREATE INDEX IF NOT EXISTS "idx_returns_order_id" ON "returns" ("order_id");
CREATE INDEX IF NOT EXISTS "idx_returns_assigned_user_id" ON "returns" ("assigned_user_id");
CREATE INDEX IF NOT EXISTS "idx_returns_status" ON "returns" ("status");
CREATE INDEX IF NOT EXISTS "idx_returns_completed_at_null" ON "returns" ("completed_at") WHERE "completed_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_return_items_return_id" ON "return_items" ("return_id");
