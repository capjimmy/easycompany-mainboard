CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  user_id UUID NOT NULL REFERENCES users(id),
  user_name TEXT NOT NULL,
  certificate_type TEXT NOT NULL, -- 'employment' (재직증명서), 'career' (경력증명서), 'salary' (급여명세서)
  issue_number TEXT NOT NULL, -- 발급번호
  issue_date TEXT NOT NULL,
  purpose TEXT, -- 발급용도
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'issued'
  approved_by UUID REFERENCES users(id),
  approved_by_name TEXT,
  approved_at TEXT,
  content JSONB, -- certificate-specific data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_company ON certificates(company_id);
