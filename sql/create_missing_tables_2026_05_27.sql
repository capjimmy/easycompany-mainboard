-- =========================================================
-- 누락 테이블 3개 생성 (2026-05-27)
-- 실행: Supabase Dashboard → SQL Editor → New query → 붙여넣고 RUN
-- =========================================================

-- 1. 계약 회의록/기타자료
CREATE TABLE IF NOT EXISTS contract_meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL,
  title TEXT,
  content TEXT,
  meeting_date DATE,
  attendees TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cmn_contract ON contract_meeting_notes(contract_id);

-- 2. 견적서 섹션 (견적서 본문 영역별 분리)
CREATE TABLE IF NOT EXISTS quote_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL,
  section_type TEXT,           -- 'header','items','summary','terms' 등
  title TEXT,
  content TEXT,                -- 자유 텍스트 또는 JSON
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qs_quote ON quote_sections(quote_id);

-- 3. 지출결의서
CREATE TABLE IF NOT EXISTS expense_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  department_id UUID,
  request_date DATE,
  category TEXT,
  amount NUMERIC DEFAULT 0,
  description TEXT,
  attachment_path TEXT,         -- 파일 경로 또는 JSON 메타데이터
  status TEXT DEFAULT 'pending', -- pending / approved / rejected
  approver_id UUID,
  approved_at TIMESTAMP,
  reject_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_er_company ON expense_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_er_user ON expense_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_er_status ON expense_requests(status);

-- 검증
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name='contract_meeting_notes') AS cmn,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name='quote_sections') AS qs,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name='expense_requests') AS er;
-- 모두 1이 나와야 정상
