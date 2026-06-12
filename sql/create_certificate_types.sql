-- Supabase 대시보드 SQL Editor에서 실행
-- =============================================
-- certificate_types 테이블 생성 (증명서 종류 관리)
-- =============================================

CREATE TABLE IF NOT EXISTS certificate_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 회사별 key 유니크 (활성 항목만)
CREATE UNIQUE INDEX IF NOT EXISTS idx_certificate_types_unique_active
  ON certificate_types (company_id, key) WHERE is_active = true;

-- 기본 증명서 종류 삽입 (건설경제연구원 + 이지컨설턴트)
-- company_id는 실제 회사 ID로 대체하세요
INSERT INTO certificate_types (company_id, key, name, description, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'employment', '재직증명서', '현재 재직 중임을 증명하는 서류', 1),
  ('a0000000-0000-0000-0000-000000000001', 'career', '경력증명서', '경력 사항을 증명하는 서류', 2)
ON CONFLICT DO NOTHING;

-- RLS 정책 (필요 시)
ALTER TABLE certificate_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "certificate_types_select" ON certificate_types
  FOR SELECT USING (true);

CREATE POLICY "certificate_types_insert" ON certificate_types
  FOR INSERT WITH CHECK (true);

CREATE POLICY "certificate_types_update" ON certificate_types
  FOR UPDATE USING (true);
