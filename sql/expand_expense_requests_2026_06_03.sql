-- =========================================================
-- expense_requests 컬럼 확장 (2026-06-03)
-- 회의: "부가세 공제 여부에 따른 매입 및 일반 경비 구분",
--      "지출결의서 입력 시 부서 및 회사 정보 추가"
-- 월매입시트 표준 필드: 거래처명, 사업자번호, 공급가, 부가세, 합계, 적요
-- =========================================================

ALTER TABLE expense_requests
  ADD COLUMN IF NOT EXISTS expense_type TEXT DEFAULT 'general',  -- 'purchase'(매입/부가세공제) | 'general'(일반경비)
  ADD COLUMN IF NOT EXISTS supplier_name TEXT,                    -- 거래처명
  ADD COLUMN IF NOT EXISTS supplier_business_number TEXT,         -- 사업자번호
  ADD COLUMN IF NOT EXISTS supply_amount NUMERIC(15, 2) DEFAULT 0, -- 공급가
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(15, 2) DEFAULT 0;    -- 부가세

-- expense_type 체크 제약 (옵션)
ALTER TABLE expense_requests
  DROP CONSTRAINT IF EXISTS expense_requests_expense_type_check;
ALTER TABLE expense_requests
  ADD CONSTRAINT expense_requests_expense_type_check
  CHECK (expense_type IN ('purchase', 'general'));

-- 기존 데이터 백필: amount만 있고 supply_amount/vat_amount NULL인 경우
UPDATE expense_requests
SET supply_amount = COALESCE(amount, 0), vat_amount = 0
WHERE supply_amount IS NULL OR supply_amount = 0;

NOTIFY pgrst, 'reload schema';

-- 검증
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'expense_requests'
  AND column_name IN ('expense_type','supplier_name','supplier_business_number','supply_amount','vat_amount')
ORDER BY column_name;
-- 5개 행이 나와야 정상
