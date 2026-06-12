-- =========================================================
-- quotes 테이블에 담당 부서 컬럼 추가 (우리 회사 담당부서)
-- 실행: Supabase Dashboard → SQL Editor → New query → RUN
-- =========================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

-- 검증
SELECT COUNT(*) AS total, COUNT(department_id) AS with_dept FROM quotes;
