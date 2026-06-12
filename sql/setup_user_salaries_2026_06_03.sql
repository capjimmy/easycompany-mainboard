-- =========================================================
-- user_salaries 테이블 — 슈퍼관리자 전용 (2026-06-03)
--
-- 보안 요구사항: "월급 데이터는 절대 다른 직원들이 보면 안 됨"
-- 해결: 별도 테이블 + 강력한 RLS (super_admin만 SELECT/INSERT/UPDATE/DELETE)
--      service_role(데스크탑 main)이 RLS 우회하지만,
--      IPC handler에서 다시 user.role 검증 추가
--
-- 실행: Supabase Dashboard → SQL Editor → New query → 붙여넣고 RUN
-- =========================================================

-- 1) 테이블 생성
CREATE TABLE IF NOT EXISTS user_salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  monthly_salary NUMERIC(15, 2) NOT NULL DEFAULT 0,
  effective_from DATE,
  effective_to DATE,
  notes TEXT,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) RLS 활성화
ALTER TABLE user_salaries ENABLE ROW LEVEL SECURITY;

-- 3) 정책: 오직 super_admin만 모든 작업 가능
DROP POLICY IF EXISTS user_salaries_super_admin_only ON user_salaries;
CREATE POLICY user_salaries_super_admin_only ON user_salaries
  FOR ALL TO authenticated
  USING (current_user_role() = 'super_admin')
  WITH CHECK (current_user_role() = 'super_admin');

-- 4) anon은 정책 자체가 없으므로 자동 차단

-- 5) PostgREST 스키마 캐시 리로드
NOTIFY pgrst, 'reload schema';

-- 6) 검증
SELECT
  'user_salaries' AS table_name,
  c.relrowsecurity AS rls_enabled,
  COUNT(p.polname) AS policy_count
FROM pg_class c
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE c.relname = 'user_salaries'
GROUP BY c.relname, c.relrowsecurity;
-- rls_enabled=true, policy_count=1 이 정상
