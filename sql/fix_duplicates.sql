-- Supabase 대시보드 SQL Editor에서 실행
-- =============================================
-- 1. 인건비/경비 중복 제거
-- =============================================

-- 중복 인건비 등급 비활성화 (가장 최신 것만 남기고 나머지 비활성화)
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY company_id, name ORDER BY updated_at DESC, created_at DESC) as rn
  FROM labor_grades
  WHERE is_active = true
)
UPDATE labor_grades
SET is_active = false, updated_at = NOW()
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- 중복 경비 항목 비활성화
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY company_id, name ORDER BY updated_at DESC, created_at DESC) as rn
  FROM expense_categories
  WHERE is_active = true
)
UPDATE expense_categories
SET is_active = false, updated_at = NOW()
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- 향후 중복 방지를 위한 유니크 인덱스 추가
CREATE UNIQUE INDEX IF NOT EXISTS idx_labor_grades_unique_active
  ON labor_grades (company_id, name) WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_categories_unique_active
  ON expense_categories (company_id, name) WHERE is_active = true;

-- =============================================
-- 2. quote_expense_items 테이블에 calculation_type, rate 컬럼 추가
--    (경비 항목의 계산 방식 정보를 저장하여 편집 시 복원)
-- =============================================
ALTER TABLE quote_expense_items ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'manual';
ALTER TABLE quote_expense_items ADD COLUMN IF NOT EXISTS rate NUMERIC DEFAULT NULL;

-- =============================================
-- 3. quotes 테이블에 section_total 컬럼 추가 (상세내역 합계)
-- =============================================
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS section_total NUMERIC DEFAULT 0;

-- =============================================
-- 4. users 테이블 role CHECK 제약조건에 department_manager 추가
-- =============================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin', 'company_admin', 'department_manager', 'employee'));
