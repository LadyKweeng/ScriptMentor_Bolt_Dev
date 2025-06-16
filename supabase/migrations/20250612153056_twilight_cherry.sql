/*
  # Add Encryption Support to Scripts Table

  1. Schema Updates
    - Add `is_encrypted` (boolean) - Whether script content is encrypted
    - Add `encryption_version` (text) - Version of encryption used

  2. Indexes
    - Add index on `is_encrypted` for filtering encrypted scripts

  3. Security
    - Maintains existing RLS policies
    - Encryption is handled client-side for maximum security
*/

-- Add new columns for encryption support
DO $$
BEGIN
  -- Add is_encrypted column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scripts' AND column_name = 'is_encrypted'
  ) THEN
    ALTER TABLE scripts ADD COLUMN is_encrypted boolean DEFAULT false;
  END IF;

  -- Add encryption_version column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scripts' AND column_name = 'encryption_version'
  ) THEN
    ALTER TABLE scripts ADD COLUMN encryption_version text;
  END IF;
END $$;

-- Create index for better query performance on encrypted scripts
CREATE INDEX IF NOT EXISTS scripts_is_encrypted_idx ON scripts(is_encrypted);

-- Update existing scripts to have is_encrypted = false if null
UPDATE scripts SET is_encrypted = false WHERE is_encrypted IS NULL;

-- Add comment explaining the encryption approach
COMMENT ON COLUMN scripts.is_encrypted IS 'Indicates if script content is encrypted client-side before storage';
COMMENT ON COLUMN scripts.encryption_version IS 'Version of encryption algorithm used for client-side encryption';