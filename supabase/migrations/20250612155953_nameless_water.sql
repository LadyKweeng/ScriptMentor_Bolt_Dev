-- First, let's check if the scripts table exists and what columns it has
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'scripts'
ORDER BY ordinal_position;

-- If the above shows the table exists but is missing encryption columns, run this:
-- Add encryption columns directly (without the conditional check that might be failing)
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS is_encrypted boolean DEFAULT false;
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS encryption_version text;

-- Create index for better query performance on encrypted scripts
CREATE INDEX IF NOT EXISTS scripts_is_encrypted_idx ON scripts(is_encrypted);

-- Update existing scripts to have is_encrypted = false if null
UPDATE scripts SET is_encrypted = false WHERE is_encrypted IS NULL;

-- Add comments explaining the encryption approach
COMMENT ON COLUMN scripts.is_encrypted IS 'Indicates if script content is encrypted client-side before storage';
COMMENT ON COLUMN scripts.encryption_version IS 'Version of encryption algorithm used for client-side encryption';

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'scripts' 
AND column_name IN ('is_encrypted', 'encryption_version');