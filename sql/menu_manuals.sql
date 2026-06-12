-- 메뉴별 매뉴얼 테이블
CREATE TABLE IF NOT EXISTS menu_manuals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  menu_key VARCHAR(100) NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, menu_key)
);

-- RLS
ALTER TABLE menu_manuals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_manuals_select" ON menu_manuals FOR SELECT USING (true);
CREATE POLICY "menu_manuals_insert" ON menu_manuals FOR INSERT WITH CHECK (true);
CREATE POLICY "menu_manuals_update" ON menu_manuals FOR UPDATE USING (true);
CREATE POLICY "menu_manuals_delete" ON menu_manuals FOR DELETE USING (true);
