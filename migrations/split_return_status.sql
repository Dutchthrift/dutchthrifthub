-- Migration: Split nieuw_onderweg into nieuw and onderweg
-- This migration adds new enum values and migrates existing data

BEGIN;

-- Step 1: Add new enum values to return_status
-- Note: PostgreSQL doesn't allow removing enum values, so we keep nieuw_onderweg as deprecated
ALTER TYPE return_status ADD VALUE IF NOT EXISTS 'nieuw';
ALTER TYPE return_status ADD VALUE IF NOT EXISTS 'onderweg';

-- Step 2: Migrate existing nieuw_onderweg returns
-- Returns WITH tracking → onderweg (approved, has label)
-- Returns WITHOUT tracking → nieuw (pending approval)

UPDATE returns 
SET status = 'onderweg' 
WHERE status = 'nieuw_onderweg' 
  AND tracking_number IS NOT NULL 
  AND tracking_number != '';

UPDATE returns 
SET status = 'nieuw' 
WHERE status = 'nieuw_onderweg';

-- Step 3: Verify migration
SELECT 
    status, 
    COUNT(*) as count,
    COUNT(CASE WHEN tracking_number IS NOT NULL AND tracking_number != '' THEN 1 END) as has_tracking
FROM returns 
WHERE status IN ('nieuw', 'onderweg', 'nieuw_onderweg')
GROUP BY status;

COMMIT;

-- Expected result:
-- status          | count | has_tracking
-- ----------------+-------+-------------
-- nieuw          | X     | 0             (no tracking)
-- onderweg       | Y     | Y             (all have tracking)
-- nieuw_onderweg | 0     | 0             (should be empty after migration)
