-- Supabase 대시보드 SQL Editor에서 실행
-- users 테이블의 role CHECK 제약조건에 department_manager 추가

-- 1. 기존 제약조건 삭제
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. department_manager 포함한 새 제약조건 추가
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin', 'company_admin', 'department_manager', 'employee'));
