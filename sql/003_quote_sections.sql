-- 견적서 계층 구조 항목 테이블
-- 대분류(level 1) > 세부(level 2) > 세세부(level 3)
CREATE TABLE IF NOT EXISTS quote_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES quote_sections(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,  -- 1=대분류, 2=세부, 3=세세부
  title TEXT NOT NULL,
  description TEXT,
  amount BIGINT DEFAULT 0,           -- 금액 (세세부에서 직접 입력, 상위는 합산)
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_quote_sections_quote_id ON quote_sections(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_sections_parent_id ON quote_sections(parent_id);

-- RLS 정책
ALTER TABLE quote_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON quote_sections FOR ALL USING (true) WITH CHECK (true);

-- 문서 템플릿 테이블
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'quote',  -- 'quote', 'contract'
  template_name TEXT NOT NULL,
  template_content TEXT,   -- HTML 템플릿 본문
  keywords JSONB DEFAULT '[]',  -- ["%%거래처명%%", "%%용역명%%", ...]
  is_default BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_templates_company ON document_templates(company_id);

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON document_templates FOR ALL USING (true) WITH CHECK (true);

-- 메일 승인 워크플로우 테이블
CREATE TABLE IF NOT EXISTS email_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL,
  approver_id UUID,
  document_type TEXT NOT NULL,  -- 'quote', 'contract'
  document_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  attachments JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_approvals_approver ON email_approvals(approver_id, status);

ALTER TABLE email_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON email_approvals FOR ALL USING (true) WITH CHECK (true);

-- 계약서 기본 데이터 설정 테이블
CREATE TABLE IF NOT EXISTS contract_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  department_id UUID,
  field_name TEXT NOT NULL,
  field_value TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, department_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_contract_defaults_company ON contract_defaults(company_id);

ALTER TABLE contract_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON contract_defaults FOR ALL USING (true) WITH CHECK (true);
