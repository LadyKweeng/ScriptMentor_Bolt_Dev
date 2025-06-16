# Database Migration Required

## Problem
The application is trying to access the `is_encrypted` column in the `scripts` table, but this column doesn't exist in your database yet.

## Solution
You need to manually apply the migration SQL to your Supabase database:

### Steps:
1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to the "SQL Editor" tab
4. Create a new query and paste the following SQL:

```sql
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
```

5. Click "Run" to execute the migration
6. Refresh your application - the errors should be resolved

### Verification
After running the migration, you can verify it worked by running this query in the SQL Editor:

```sql
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'scripts' 
AND column_name IN ('is_encrypted', 'encryption_version');
```

This should return two rows showing the new columns have been created.