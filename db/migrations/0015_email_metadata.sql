-- SnappyMail Email Metadata Table
-- This table ONLY stores metadata links between emails and ThriftHub entities
-- Email content remains on Strato IMAP server

CREATE TABLE IF NOT EXISTS email_metadata (
  id SERIAL PRIMARY KEY,
  
  -- IMAP identifiers (from SnappyMail)
  message_id VARCHAR(255) NOT NULL UNIQUE,
  thread_id VARCHAR(255),
  
  -- ThriftHub entity links
  case_id VARCHAR(50) REFERENCES cases(id) ON DELETE SET NULL,
  order_id VARCHAR(50) REFERENCES orders(id) ON DELETE SET NULL,
  return_id VARCHAR(50) REFERENCES returns(id) ON DELETE SET NULL,
  repair_id VARCHAR(50) REFERENCES repairs(id) ON DELETE SET NULL,
  
  -- Metadata
  linked_by VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
  linked_at TIMESTAMP DEFAULT NOW(),
  
  -- Optional: Store subject for search (NOT full body)
  subject TEXT,
  from_email VARCHAR(255),
  to_email VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_email_metadata_message_id ON email_metadata(message_id);
CREATE INDEX idx_email_metadata_case_id ON email_metadata(case_id);
CREATE INDEX idx_email_metadata_order_id ON email_metadata(order_id);
CREATE INDEX idx_email_metadata_return_id ON email_metadata(return_id);
CREATE INDEX idx_email_metadata_repair_id ON email_metadata(repair_id);
