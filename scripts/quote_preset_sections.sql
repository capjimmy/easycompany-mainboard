-- 견적 사전 항목 분류 (Preset Section Categories)
-- 대분류 → 세분류 → 세세분류 3단계 계층 구조

CREATE TABLE IF NOT EXISTS quote_preset_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
  title TEXT NOT NULL,
  parent_id UUID REFERENCES quote_preset_sections(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_quote_preset_sections_company ON quote_preset_sections(company_id);
CREATE INDEX IF NOT EXISTS idx_quote_preset_sections_parent ON quote_preset_sections(parent_id);
CREATE INDEX IF NOT EXISTS idx_quote_preset_sections_active ON quote_preset_sections(company_id, is_active);

-- RLS (Row Level Security)
ALTER TABLE quote_preset_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company preset sections"
  ON quote_preset_sections FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage preset sections"
  ON quote_preset_sections FOR ALL
  USING (true);
