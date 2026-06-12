-- Supabase 대시보드 SQL Editor에서 실행
-- =============================================
-- 계약서에 인건비/경비/상세내역(섹션) 테이블 추가
-- =============================================

-- 1. 계약서 인건비 항목
CREATE TABLE IF NOT EXISTS contract_labor_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  grade_id TEXT,
  grade_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  participation_rate NUMERIC DEFAULT 1,
  months NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  subtotal NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contract_labor_items_contract ON contract_labor_items(contract_id);

-- 2. 계약서 경비 항목
CREATE TABLE IF NOT EXISTS contract_expense_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  category_id TEXT,
  category_name TEXT NOT NULL,
  calculation_type TEXT DEFAULT 'manual',
  rate NUMERIC,
  amount NUMERIC DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contract_expense_items_contract ON contract_expense_items(contract_id);

-- 3. 계약서 상세내역 (대분류/세부/세세부)
CREATE TABLE IF NOT EXISTS contract_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  parent_id UUID,
  level INTEGER DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contract_sections_contract ON contract_sections(contract_id);

-- 4. contracts 테이블에 세부 금액 컬럼 추가
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS labor_total NUMERIC DEFAULT 0;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS expense_total NUMERIC DEFAULT 0;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS section_total NUMERIC DEFAULT 0;

-- 5. RLS 정책
ALTER TABLE contract_labor_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_labor_items_all" ON contract_labor_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "contract_expense_items_all" ON contract_expense_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "contract_sections_all" ON contract_sections FOR ALL USING (true) WITH CHECK (true);
