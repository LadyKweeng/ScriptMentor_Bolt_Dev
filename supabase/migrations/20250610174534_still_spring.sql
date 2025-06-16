/*
  # Add Chunked Script Support

  1. Schema Updates
    - Add `chunks` (jsonb) - For storing script chunks
    - Add `chunking_strategy` (text) - Strategy used for chunking
    - Add `total_pages` (integer) - Total estimated pages
    - Add `is_chunked` (boolean) - Whether script is chunked

  2. Indexes
    - Add index on `is_chunked` for filtering
    - Add index on `chunking_strategy` for analytics
*/

-- Add new columns for chunked script support
DO $$
BEGIN
  -- Add chunks column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scripts' AND column_name = 'chunks'
  ) THEN
    ALTER TABLE scripts ADD COLUMN chunks jsonb;
  END IF;

  -- Add chunking_strategy column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scripts' AND column_name = 'chunking_strategy'
  ) THEN
    ALTER TABLE scripts ADD COLUMN chunking_strategy text;
  END IF;

  -- Add total_pages column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scripts' AND column_name = 'total_pages'
  ) THEN
    ALTER TABLE scripts ADD COLUMN total_pages integer;
  END IF;

  -- Add is_chunked column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scripts' AND column_name = 'is_chunked'
  ) THEN
    ALTER TABLE scripts ADD COLUMN is_chunked boolean DEFAULT false;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS scripts_is_chunked_idx ON scripts(is_chunked);
CREATE INDEX IF NOT EXISTS scripts_chunking_strategy_idx ON scripts(chunking_strategy);

-- Update existing scripts to have is_chunked = false if null
UPDATE scripts SET is_chunked = false WHERE is_chunked IS NULL;