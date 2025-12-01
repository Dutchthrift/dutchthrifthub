-- Migration: Update default return status to 'nieuw'
-- This ensures new manually created returns get the correct default status

BEGIN;

-- Update the default value for the status column
-- Note: Changing column default doesn't affect existing rows, only new inserts
ALTER TABLE returns 
ALTER COLUMN status SET DEFAULT 'nieuw';

-- Optional: Update any existing returns with 'nieuw_onderweg' status to 'nieuw'
-- (Uncomment if you want to migrate existing returns)
-- UPDATE returns 
-- SET status = 'nieuw' 
-- WHERE status = 'nieuw_onderweg';

COMMIT;

-- Verify the change
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_name = 'returns' 
  AND column_name = 'status';
