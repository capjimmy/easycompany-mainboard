-- =========================================================
-- 경비 항목에 부가세 구분 컬럼 추가
-- 실행: Supabase Dashboard → SQL Editor → New query → 붙여넣고 RUN
-- =========================================================

-- expense_settlement_items 테이블에 부가세 관련 컬럼 추가
ALTER TABLE expense_settlement_items ADD COLUMN IF NOT EXISTS vat_included BOOLEAN DEFAULT false;
ALTER TABLE expense_settlement_items ADD COLUMN IF NOT EXISTS vat_amount NUMERIC DEFAULT 0;
ALTER TABLE expense_settlement_items ADD COLUMN IF NOT EXISTS supply_amount NUMERIC DEFAULT 0;
-- category_name 컬럼은 이미 위에서 추가됐다면 idempotent
ALTER TABLE expense_settlement_items ADD COLUMN IF NOT EXISTS category_name TEXT;

-- 기존 행: amount만 있는 상태 → supply_amount = amount, vat_amount = 0, vat_included = false 로 보정
UPDATE expense_settlement_items
SET supply_amount = amount,
    vat_amount = 0,
    vat_included = false
WHERE supply_amount IS NULL OR supply_amount = 0;

-- 검증
SELECT
  COUNT(*) AS total,
  COUNT(NULLIF(vat_amount, 0)) AS with_vat,
  COUNT(*) FILTER (WHERE vat_included = true) AS vat_included_cnt,
  COUNT(category_name) AS has_category_name
FROM expense_settlement_items;
