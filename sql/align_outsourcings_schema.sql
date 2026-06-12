-- =========================================================
-- outsourcings 테이블 스키마 정렬 (코드의 vendor_* 명세에 맞춤)
-- 실행 방법: Supabase Dashboard → SQL Editor → New query → 붙여넣고 RUN
-- 안전: 모든 ALTER에 IF NOT EXISTS / 모든 UPDATE는 NULL인 행만 채움
-- =========================================================

-- 1. 누락 컬럼 추가
ALTER TABLE outsourcings ADD COLUMN IF NOT EXISTS vendor_name TEXT;
ALTER TABLE outsourcings ADD COLUMN IF NOT EXISTS vendor_business_number TEXT;
ALTER TABLE outsourcings ADD COLUMN IF NOT EXISTS vendor_contact_name TEXT;
ALTER TABLE outsourcings ADD COLUMN IF NOT EXISTS vendor_contact_phone TEXT;
ALTER TABLE outsourcings ADD COLUMN IF NOT EXISTS vendor_contact_email TEXT;
ALTER TABLE outsourcings ADD COLUMN IF NOT EXISTS outsourcing_amount NUMERIC DEFAULT 0;
ALTER TABLE outsourcings ADD COLUMN IF NOT EXISTS vat_amount NUMERIC DEFAULT 0;
ALTER TABLE outsourcings ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;
ALTER TABLE outsourcings ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;
ALTER TABLE outsourcings ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC DEFAULT 0;
ALTER TABLE outsourcings ADD COLUMN IF NOT EXISTS contract_number TEXT;

-- 2. 기존 데이터 복사 (구 컬럼 → 신 컬럼)
UPDATE outsourcings
SET
  vendor_name           = COALESCE(vendor_name, outsource_company),
  vendor_contact_name   = COALESCE(vendor_contact_name, outsource_contact),
  vendor_contact_phone  = COALESCE(vendor_contact_phone, outsource_phone),
  outsourcing_amount    = COALESCE(NULLIF(outsourcing_amount, 0), outsource_amount, 0)
WHERE vendor_name IS NULL OR outsourcing_amount = 0 OR outsourcing_amount IS NULL;

-- 3. notes 컬럼에 저장된 "사업자: 123-45-67890 | 대표: 홍길동 | 주소: ..." 문자열에서
--    사업자번호 추출 (KERI 외주업체정보 import 시 작성된 형식)
UPDATE outsourcings
SET vendor_business_number = TRIM(SUBSTRING(notes FROM '사업자:\s*([0-9-]+)'))
WHERE vendor_business_number IS NULL
  AND notes ~ '사업자:';

-- 4. VAT/total/remaining 재계산
UPDATE outsourcings
SET
  vat_amount       = CASE WHEN vat_included THEN ROUND(COALESCE(outsourcing_amount, 0) * 0.1) ELSE 0 END,
  total_amount     = CASE WHEN vat_included THEN COALESCE(outsourcing_amount, 0) + ROUND(COALESCE(outsourcing_amount, 0) * 0.1)
                          ELSE COALESCE(outsourcing_amount, 0) END,
  remaining_amount = CASE WHEN vat_included THEN COALESCE(outsourcing_amount, 0) + ROUND(COALESCE(outsourcing_amount, 0) * 0.1) - COALESCE(paid_amount, 0)
                          ELSE COALESCE(outsourcing_amount, 0) - COALESCE(paid_amount, 0) END
WHERE total_amount IS NULL OR total_amount = 0;

-- 5. contract_number 채우기 (contracts 조인)
UPDATE outsourcings o
SET contract_number = c.contract_number
FROM contracts c
WHERE o.contract_id = c.id
  AND (o.contract_number IS NULL OR o.contract_number = '');

-- 6. (검증용) 확인 쿼리 — 실행 후 결과로 마이그레이션 성공 확인
SELECT
  COUNT(*)                                      AS total,
  COUNT(vendor_name)                            AS has_vendor_name,
  COUNT(NULLIF(outsourcing_amount, 0))          AS has_amount,
  COUNT(contract_id)                            AS has_contract,
  COUNT(contract_number)                        AS has_contract_number,
  COUNT(vendor_business_number)                 AS has_biz_num
FROM outsourcings;
