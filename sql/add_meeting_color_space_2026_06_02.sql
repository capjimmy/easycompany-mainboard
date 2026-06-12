-- =========================================================
-- meeting_reservations에 color + space_id + space_name 컬럼 추가 (2026-06-02)
--
-- 추가 이유:
-- - color: 예약별 강조색 (캘린더 셀 배경)
-- - space_id, space_name: 어떤 공간(회의실) 예약인지 명시
--
-- 실행: Supabase Dashboard → SQL Editor → New query → 붙여넣고 RUN
-- =========================================================

ALTER TABLE meeting_reservations
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS space_name TEXT;

-- PostgREST 스키마 캐시 리로드
NOTIFY pgrst, 'reload schema';

-- 검증
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'meeting_reservations'
  AND column_name IN ('color', 'space_id', 'space_name');
-- 3개 행이 나와야 정상
