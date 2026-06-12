-- =========================================================
-- 외주 + 거래처 중복 데이터 정리 (2026-06-02)
--
-- 발견된 중복:
-- 1. outsourcings: 19개 그룹, 80건 삭제 가능
--    (같은 contract_id + vendor_business_number/vendor_name 중복)
-- 2. client_companies: 3개 그룹, 4건 삭제 가능
--    (같은 company_id + 이름 중복: 동부엔텍, 제일엔지니어링, LH)
--
-- 정책: 가장 오래된 row(created_at min)는 유지, 나머지 중복 row만 삭제.
--       금액(outsourcing_amount)이나 다른 데이터가 있는 row를 우선 보존.
--
-- 실행: Supabase Dashboard → SQL Editor → New query → 붙여넣고 RUN
-- =========================================================

-- ===== 1) outsourcings 중복 정리 =====
-- 같은 contract_id + vendor key 그룹 내에서, 가장 데이터 풍부한 row 1건만 유지
WITH ranked AS (
  SELECT
    id,
    contract_id,
    COALESCE(vendor_business_number, vendor_name, outsource_company) AS vendor_key,
    -- 우선순위: amount > 0 > 이전 created_at
    ROW_NUMBER() OVER (
      PARTITION BY contract_id, COALESCE(vendor_business_number, vendor_name, outsource_company)
      ORDER BY
        CASE WHEN COALESCE(outsourcing_amount, outsource_amount, total_amount, 0) > 0 THEN 0 ELSE 1 END,
        created_at ASC
    ) AS rn
  FROM outsourcings
  WHERE COALESCE(vendor_business_number, vendor_name, outsource_company) IS NOT NULL
)
DELETE FROM outsourcings
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ===== 2) client_companies 중복 정리 =====
-- 같은 company_id + name 그룹 내에서 가장 데이터 풍부한 row 1건만 유지
WITH ranked AS (
  SELECT
    id,
    company_id,
    name,
    -- 우선순위: business_number 있는 row > ceo_name 있는 row > 이전 created_at
    ROW_NUMBER() OVER (
      PARTITION BY company_id, TRIM(name)
      ORDER BY
        CASE WHEN business_number IS NOT NULL AND business_number != '' THEN 0 ELSE 1 END,
        CASE WHEN ceo_name IS NOT NULL AND ceo_name != '' THEN 0 ELSE 1 END,
        created_at ASC
    ) AS rn
  FROM client_companies
  WHERE name IS NOT NULL
)
DELETE FROM client_companies
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ===== 3) 검증 =====
SELECT
  'outsourcings' AS table_name,
  COUNT(*) AS total_rows,
  COUNT(*) - COUNT(DISTINCT (contract_id, COALESCE(vendor_business_number, vendor_name, outsource_company))) AS remaining_dups
FROM outsourcings
WHERE COALESCE(vendor_business_number, vendor_name, outsource_company) IS NOT NULL
UNION ALL
SELECT
  'client_companies',
  COUNT(*),
  COUNT(*) - COUNT(DISTINCT (company_id, TRIM(name)))
FROM client_companies
WHERE name IS NOT NULL;
-- remaining_dups가 0이어야 정상
