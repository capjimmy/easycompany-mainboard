-- Add 2-step approval fields to leave_requests table
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS dept_approved_by UUID REFERENCES users(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS dept_approved_at TIMESTAMPTZ;

-- Note: The status column already exists. The new 'dept_approved' value is used
-- alongside existing 'pending', 'approved', 'rejected' values.
-- Status flow:
--   pending -> dept_approved (department_manager approves)
--   dept_approved -> approved (company_admin final approval)
--   pending -> approved (company_admin direct approval, bypassing dept manager)
--   pending -> rejected (department_manager or company_admin rejects)
--   dept_approved -> rejected (company_admin rejects after dept approval)
