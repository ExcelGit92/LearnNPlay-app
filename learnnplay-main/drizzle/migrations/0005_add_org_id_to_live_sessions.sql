-- Add org_id column to live_sessions if it doesn't exist
-- This is needed for subscription limit checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'live_sessions' 
    AND column_name = 'org_id'
  ) THEN
    ALTER TABLE live_sessions ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;
