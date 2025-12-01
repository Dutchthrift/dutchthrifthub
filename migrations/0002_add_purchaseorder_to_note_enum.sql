-- Migration: Add purchaseOrder to note_entity_type enum
-- This allows notes to be attached to purchase orders

ALTER TYPE note_entity_type ADD VALUE IF NOT EXISTS 'purchaseOrder';
