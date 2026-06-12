-- Add annual_leave_override column for manual override of auto-calculated annual leave
ALTER TABLE users ADD COLUMN IF NOT EXISTS annual_leave_override NUMERIC;
