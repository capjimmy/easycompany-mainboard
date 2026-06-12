-- migrate_members.sql
-- 계약서/견적서 다중 멤버 배정 테이블

CREATE TABLE IF NOT EXISTS contract_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_name TEXT,
  role TEXT DEFAULT 'member', -- 'main' or 'member'
  assigned_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contract_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_contract_members_contract ON contract_members(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_members_user ON contract_members(user_id);

CREATE TABLE IF NOT EXISTS quote_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_name TEXT,
  role TEXT DEFAULT 'member',
  assigned_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quote_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_quote_members_quote ON quote_members(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_members_user ON quote_members(user_id);

NOTIFY pgrst, 'reload schema';
