-- Subtasks table for breaking down todos into smaller tasks
CREATE TABLE IF NOT EXISTS subtasks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  todo_id VARCHAR NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_position ON subtasks(todo_id, position);

-- Todo attachments table
CREATE TABLE IF NOT EXISTS todo_attachments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  todo_id VARCHAR NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  content_type TEXT,
  size INTEGER,
  uploaded_by VARCHAR REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todo_attachments_todo_id ON todo_attachments(todo_id);

-- Todo time logs table (for time tracking)
CREATE TABLE IF NOT EXISTS todo_time_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  todo_id VARCHAR NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todo_time_logs_todo_id ON todo_time_logs(todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_time_logs_user_id ON todo_time_logs(user_id);

-- Add estimated_hours column to todos table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'todos' AND column_name = 'estimated_hours'
  ) THEN
    ALTER TABLE todos ADD COLUMN estimated_hours DECIMAL(5,2);
  END IF;
END $$;
