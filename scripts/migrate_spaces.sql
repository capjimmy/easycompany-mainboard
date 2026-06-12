-- ===============================================
-- Spaces (공간 관리) 마이그레이션
-- ===============================================
CREATE TABLE IF NOT EXISTS spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  capacity INTEGER DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spaces_company_id ON spaces(company_id);
CREATE INDEX IF NOT EXISTS idx_spaces_is_active ON spaces(is_active);
