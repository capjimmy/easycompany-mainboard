-- 견적서 정부양식 자동생성에 필요한 견적(quotes) 추가 필드
-- Supabase SQL Editor에서 실행. 모두 nullable — 기존 데이터 영향 없음.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS site_name      TEXT,   -- 현장명
  ADD COLUMN IF NOT EXISTS service_scope  TEXT,   -- 용역범위
  ADD COLUMN IF NOT EXISTS researcher1    TEXT,   -- 담당자1 (우리 연구진)
  ADD COLUMN IF NOT EXISTS researcher2    TEXT,   -- 담당자2
  ADD COLUMN IF NOT EXISTS researcher3    TEXT;   -- 담당자3
