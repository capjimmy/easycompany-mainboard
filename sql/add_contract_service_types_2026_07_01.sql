-- =========================================================
-- 2026-07-01 계약: 사업부별 용역종류 (1차 단일 / 2차 다중)
-- 실행: Supabase Dashboard → SQL Editor → New query → 붙여넣고 RUN
-- =========================================================

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS service_division TEXT;   -- 용역 사업부(건설/학술/개발/외주용역/인증)
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS service_type_1 TEXT;     -- 용역종류 1차(단일)
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS service_type_2 TEXT[];   -- 용역종류 2차(다중)

-- 검증
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='contracts' AND column_name='service_division') AS division,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='contracts' AND column_name='service_type_1') AS type1,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='contracts' AND column_name='service_type_2') AS type2;
