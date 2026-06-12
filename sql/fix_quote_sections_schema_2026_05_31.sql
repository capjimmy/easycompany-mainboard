-- =========================================================
-- BUG #1 수정: quote_sections 스키마 불일치 (2026-05-31)
--
-- 문제: IPC 코드는 level/parent_id/description/amount 컬럼을 사용하지만
--      실제 DB는 section_type/content만 있어서 견적 섹션 저장 자체가 실패함.
--
-- 해결: 누락 컬럼 추가 + 기존 section_type 값을 level로 매핑 (데이터 보존)
--
-- 실행: Supabase Dashboard → SQL Editor → New query → 붙여넣고 RUN
-- =========================================================

-- 1) 누락 컬럼 추가 (IF NOT EXISTS — 멱등)
ALTER TABLE quote_sections ADD COLUMN IF NOT EXISTS level INTEGER;
ALTER TABLE quote_sections ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES quote_sections(id) ON DELETE CASCADE;
ALTER TABLE quote_sections ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE quote_sections ADD COLUMN IF NOT EXISTS amount NUMERIC(15, 2) DEFAULT 0;

-- 2) 기존 section_type 값 → level 매핑 (데이터 보존)
--    major=1, middle=2, minor=3, 그 외는 1로
UPDATE quote_sections
SET level = CASE section_type
  WHEN 'major' THEN 1
  WHEN 'middle' THEN 2
  WHEN 'minor' THEN 3
  ELSE 1
END
WHERE level IS NULL;

-- 3) content가 있고 description이 비어있으면 content를 description으로 복사
UPDATE quote_sections
SET description = content
WHERE description IS NULL AND content IS NOT NULL;

-- 4) PostgREST 스키마 캐시 리로드 (앱 재시작 안 해도 즉시 반영)
NOTIFY pgrst, 'reload schema';

-- 5) 검증
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE level IS NOT NULL) AS rows_with_level,
  COUNT(*) FILTER (WHERE parent_id IS NOT NULL) AS rows_with_parent,
  COUNT(DISTINCT level) AS distinct_levels
FROM quote_sections;
-- total_rows = rows_with_level 이어야 정상 (모든 행에 level 채워짐)
