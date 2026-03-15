-- =============================================
-- Notifications & Leave Requests Schema
-- =============================================

-- Notifications (알림)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'leave_request', 'leave_approved', 'leave_rejected', 'system', 'general'
  title TEXT NOT NULL,
  message TEXT,
  link TEXT, -- 클릭 시 이동할 경로 (예: /hr/leave)
  is_read BOOLEAN DEFAULT false,
  related_id UUID, -- 관련 엔티티 ID (예: leave_request id)
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);

-- Leave Requests (연차/휴가 신청)
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL DEFAULT 'annual', -- annual(연차), half_am(오전반차), half_pm(오후반차), sick(병가), special(특별휴가)
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days NUMERIC NOT NULL DEFAULT 1, -- 사용일수 (반차=0.5)
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, dept_approved, approved, rejected
  dept_approved_by UUID REFERENCES users(id),
  dept_approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_company ON leave_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
