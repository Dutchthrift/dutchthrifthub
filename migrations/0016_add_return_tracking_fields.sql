-- Add tracking fields for Shopify reverse delivery sync
ALTER TABLE returns ADD COLUMN IF NOT EXISTS tracking_carrier TEXT;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS label_created_at TIMESTAMP;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS shopify_status TEXT;
