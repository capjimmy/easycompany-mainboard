-- =========================================================
-- 추가 스키마 보정 (2026-05-31, 최종검토)
--
-- 발견된 이슈:
-- 1. expense_settlement_items.updated_at 누락 → IPC가 update 시도 시 에러
-- 2. FK CASCADE 누락 4건:
--    - contract_members.contract_id (계약 삭제 시 멤버 고아)
--    - contract_meeting_notes.contract_id (계약 삭제 시 회의록 고아)
--    - quote_sections.quote_id (견적 삭제 시 섹션 고아)
--    - quote_members.quote_id (견적 삭제 시 멤버 고아)
--
-- 실행: Supabase Dashboard → SQL Editor → New query → 붙여넣고 RUN
-- =========================================================

-- ===== 1) expense_settlement_items.updated_at 추가 =====
ALTER TABLE expense_settlement_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE expense_settlement_items SET updated_at = created_at WHERE updated_at IS NULL;

-- ===== 2) 고아 row 청소 (기존 CASCADE 없는 상태에서 누적된 데이터) =====
-- 부모(contracts/quotes)가 없는 자식 row를 먼저 삭제해야 FK 추가 가능
DELETE FROM contract_members
WHERE contract_id NOT IN (SELECT id FROM contracts);
DELETE FROM contract_meeting_notes
WHERE contract_id NOT IN (SELECT id FROM contracts);
DELETE FROM quote_sections
WHERE quote_id NOT IN (SELECT id FROM quotes);
DELETE FROM quote_members
WHERE quote_id NOT IN (SELECT id FROM quotes);

-- ===== 3) FK CASCADE 추가 (4개 테이블) =====
-- 기존 FK 제약을 찾아서 DROP 후 CASCADE로 재생성
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  -- contract_members.contract_id
  SELECT conname INTO fk_name FROM pg_constraint
  WHERE conrelid = 'contract_members'::regclass AND contype = 'f'
    AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'contract_members'::regclass AND attname = 'contract_id')];
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE contract_members DROP CONSTRAINT %I', fk_name);
  END IF;
  ALTER TABLE contract_members
    ADD CONSTRAINT contract_members_contract_id_fkey
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;

  -- contract_meeting_notes.contract_id
  fk_name := NULL;
  SELECT conname INTO fk_name FROM pg_constraint
  WHERE conrelid = 'contract_meeting_notes'::regclass AND contype = 'f'
    AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'contract_meeting_notes'::regclass AND attname = 'contract_id')];
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE contract_meeting_notes DROP CONSTRAINT %I', fk_name);
  END IF;
  ALTER TABLE contract_meeting_notes
    ADD CONSTRAINT contract_meeting_notes_contract_id_fkey
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;

  -- quote_sections.quote_id
  fk_name := NULL;
  SELECT conname INTO fk_name FROM pg_constraint
  WHERE conrelid = 'quote_sections'::regclass AND contype = 'f'
    AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'quote_sections'::regclass AND attname = 'quote_id')];
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE quote_sections DROP CONSTRAINT %I', fk_name);
  END IF;
  ALTER TABLE quote_sections
    ADD CONSTRAINT quote_sections_quote_id_fkey
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;

  -- quote_members.quote_id
  fk_name := NULL;
  SELECT conname INTO fk_name FROM pg_constraint
  WHERE conrelid = 'quote_members'::regclass AND contype = 'f'
    AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'quote_members'::regclass AND attname = 'quote_id')];
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE quote_members DROP CONSTRAINT %I', fk_name);
  END IF;
  ALTER TABLE quote_members
    ADD CONSTRAINT quote_members_quote_id_fkey
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;
END $$;

-- ===== 4) PostgREST 스키마 캐시 리로드 =====
NOTIFY pgrst, 'reload schema';

-- ===== 5) 검증 =====
SELECT
  COUNT(*) AS total_settlement_items,
  COUNT(*) FILTER (WHERE updated_at IS NOT NULL) AS with_updated_at
FROM expense_settlement_items;

-- FK CASCADE 확인 — 4개 행이 'CASCADE'로 나와야 정상
SELECT
  tc.table_name,
  kcu.column_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name IN ('contract_members','contract_meeting_notes','quote_sections','quote_members')
  AND kcu.column_name IN ('contract_id','quote_id')
ORDER BY tc.table_name;
