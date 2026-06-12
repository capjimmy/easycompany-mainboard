-- =========================================================
-- Supabase Auth 마이그레이션 사전준비 (2026-05-29)
-- 실행: Supabase Dashboard → SQL Editor → New query → 붙여넣고 RUN
--
-- 이 SQL 하나만 실행하시면 됩니다. 이후 모든 작업은 자동.
-- =========================================================

-- 1. users 테이블에 Auth 연동 컬럼 추가
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

-- 2. email 컬럼이 NULL인 경우 username@easy.local 로 백필 (Auth 로그인용 가짜 이메일)
UPDATE users
SET email = username || '@easy.local'
WHERE (email IS NULL OR email = '') AND username IS NOT NULL;

-- 3. RLS 우회용 헬퍼 함수 — service_role은 자동 우회, 일반 인증 사용자는 이 함수로 컨텍스트 결정
CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT company_id FROM public.users
  WHERE auth_user_id = auth.uid() OR id::text = auth.jwt() ->> 'sub'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.users
  WHERE auth_user_id = auth.uid() OR id::text = auth.jwt() ->> 'sub'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_internal_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT id FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1
$$;

-- 4. 검증
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='users' AND column_name='auth_user_id') AS users_auth_uid_col,
  (SELECT COUNT(*) FROM users WHERE email IS NOT NULL) AS users_with_email,
  (SELECT COUNT(*) FROM pg_proc WHERE proname='current_user_company_id') AS fn_company,
  (SELECT COUNT(*) FROM pg_proc WHERE proname='current_user_role') AS fn_role;
-- 결과: 1 / 62 / 1 / 1 가 정상
