-- Add case_type and case_source enums
DO $$ BEGIN
  CREATE TYPE case_type AS ENUM ('return_request', 'complaint', 'shipping_issue', 'payment_issue', 'general', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE case_source AS ENUM ('email', 'shopify', 'manual');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns to cases table
ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_type case_type DEFAULT 'general';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS other_type_description text;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS source case_source DEFAULT 'manual';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS waiting_reason text;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS is_escalated boolean DEFAULT false;
