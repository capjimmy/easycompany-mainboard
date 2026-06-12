-- =========================================================
-- 🚨 긴급: allow_all 정책 일괄 제거 + 누락 테이블 RLS 적용 (2026-05-29)
--
-- 발견된 문제:
-- - 모든 테이블에 `allow_all (USING true, FOR ALL TO PUBLIC)` 정책이 존재
-- - RLS 정책은 OR 결합 → allow_all이 있으면 다른 모든 제한 정책이 무의미
-- - 결과: anon key로 password_hash 포함 모든 데이터 노출
--
-- 실행: Supabase Dashboard → SQL Editor → New query → 붙여넣고 RUN
-- =========================================================

-- ===== 1단계: 진단 — allow_all 정책이 있는 테이블 목록 =====
-- (실행 후 결과 확인용)
SELECT
  c.relname AS table_name,
  COUNT(*) FILTER (WHERE p.polname ILIKE '%allow_all%' OR pg_get_expr(p.polqual, p.polrelid) = 'true') AS allow_all_count,
  COUNT(*) AS total_policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public' AND c.relkind = 'r'
GROUP BY c.relname
HAVING COUNT(*) FILTER (WHERE p.polname ILIKE '%allow_all%' OR pg_get_expr(p.polqual, p.polrelid) = 'true') > 0
ORDER BY c.relname;

-- ===== 2단계: allow_all 정책 일괄 제거 =====
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, p.polname AS pol
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (p.polname ILIKE '%allow_all%' OR pg_get_expr(p.polqual, p.polrelid) = 'true')
      -- 단, 마스터 데이터 read 정책(USING true이지만 SELECT-only)은 보존
      AND NOT (p.polname IN ('expense_categories_read','labor_grades_read','certificate_types_read','settings_read','attached_documents_auth'))
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.tbl);
    RAISE NOTICE 'Dropped policy % on %', r.pol, r.tbl;
  END LOOP;
END $$;

-- ===== 3단계: RLS 미적용 3개 테이블 활성화 + 정책 =====
ALTER TABLE meeting_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_departments ENABLE ROW LEVEL SECURITY;

-- meeting_reservations: 회사 격리 (company_id가 있다고 가정 — 없으면 인증사용자 전체)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='meeting_reservations' AND column_name='company_id') THEN
    DROP POLICY IF EXISTS meeting_reservations_company_iso ON meeting_reservations;
    EXECUTE 'CREATE POLICY meeting_reservations_company_iso ON meeting_reservations FOR ALL TO authenticated USING (
      current_user_role() = ''super_admin'' OR company_id = current_user_company_id()
    )';
  ELSE
    DROP POLICY IF EXISTS meeting_reservations_auth ON meeting_reservations;
    EXECUTE 'CREATE POLICY meeting_reservations_auth ON meeting_reservations FOR ALL TO authenticated USING (true)';
  END IF;
END $$;

-- user_companies: 본인 또는 super_admin
DROP POLICY IF EXISTS user_companies_self ON user_companies;
CREATE POLICY user_companies_self ON user_companies FOR ALL TO authenticated USING (
  current_user_role() = 'super_admin'
  OR user_id = current_user_internal_id()
);

-- user_departments: 본인 또는 super_admin
DROP POLICY IF EXISTS user_departments_self ON user_departments;
CREATE POLICY user_departments_self ON user_departments FOR ALL TO authenticated USING (
  current_user_role() = 'super_admin'
  OR user_id = current_user_internal_id()
);

-- ===== 4단계: 누락된 18개 관계 테이블 정책 적용 =====
-- contract_*_items, quote_*_items, contract_sections, etc.

-- 계약 종속 테이블들
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'contract_expense_items','contract_labor_items','contract_sections'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_via_contract ON %I', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_via_contract ON %I FOR ALL TO authenticated USING (
        current_user_role() = 'super_admin'
        OR contract_id IN (SELECT id FROM contracts WHERE company_id = current_user_company_id())
      )
    $f$, t, t);
  END LOOP;
END $$;

-- 견적 종속 테이블들
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'quote_expense_items','quote_labor_items'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_via_quote ON %I', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_via_quote ON %I FOR ALL TO authenticated USING (
        current_user_role() = 'super_admin'
        OR quote_id IN (SELECT id FROM quotes WHERE company_id = current_user_company_id())
      )
    $f$, t, t);
  END LOOP;
END $$;

-- 마스터 데이터 (모두 읽기 허용, 관리자만 쓰기)
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'menu_manuals','menu_permissions','hwpx_templates','document_templates',
    'quote_preset_sections','sequences'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_read ON %I', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_read ON %I FOR SELECT TO authenticated USING (true)
    $f$, t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_write ON %I', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_write ON %I FOR ALL TO authenticated USING (
        current_user_role() IN ('super_admin','company_admin')
      )
    $f$, t, t);
  END LOOP;
END $$;

-- client_company_financials: 거래처 종속 (company_id 통해 격리)
DROP POLICY IF EXISTS ccf_via_client ON client_company_financials;
CREATE POLICY ccf_via_client ON client_company_financials FOR ALL TO authenticated USING (
  current_user_role() = 'super_admin'
  OR client_company_id IN (SELECT id FROM client_companies WHERE company_id = current_user_company_id())
);

-- deposits: company_id가 있다고 가정 (없으면 인증사용자 전체)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='deposits' AND column_name='company_id') THEN
    DROP POLICY IF EXISTS deposits_company_iso ON deposits;
    EXECUTE 'CREATE POLICY deposits_company_iso ON deposits FOR ALL TO authenticated USING (
      current_user_role() = ''super_admin'' OR company_id = current_user_company_id()
    )';
  ELSE
    DROP POLICY IF EXISTS deposits_auth ON deposits;
    EXECUTE 'CREATE POLICY deposits_auth ON deposits FOR ALL TO authenticated USING (true)';
  END IF;
END $$;

-- generated_documents: 인증사용자 전체 (감사로그 성격)
DROP POLICY IF EXISTS generated_documents_auth ON generated_documents;
CREATE POLICY generated_documents_auth ON generated_documents FOR ALL TO authenticated USING (true);

-- messenger_read_receipts: 본인만 (user_id가 text 타입일 수 있으므로 양쪽 캐스팅)
DO $$
DECLARE
  col_type TEXT;
BEGIN
  SELECT data_type INTO col_type FROM information_schema.columns
  WHERE table_schema='public' AND table_name='messenger_read_receipts' AND column_name='user_id';

  IF col_type IS NOT NULL THEN
    DROP POLICY IF EXISTS messenger_read_receipts_self ON messenger_read_receipts;
    IF col_type = 'uuid' THEN
      EXECUTE 'CREATE POLICY messenger_read_receipts_self ON messenger_read_receipts FOR ALL TO authenticated USING (
        current_user_role() = ''super_admin'' OR user_id = current_user_internal_id()
      )';
    ELSE
      -- text 타입이면 캐스팅
      EXECUTE 'CREATE POLICY messenger_read_receipts_self ON messenger_read_receipts FOR ALL TO authenticated USING (
        current_user_role() = ''super_admin'' OR user_id::text = current_user_internal_id()::text
      )';
    END IF;
  ELSE
    DROP POLICY IF EXISTS messenger_read_receipts_auth ON messenger_read_receipts;
    EXECUTE 'CREATE POLICY messenger_read_receipts_auth ON messenger_read_receipts FOR ALL TO authenticated USING (true)';
  END IF;
END $$;

-- ===== 5단계: 최종 검증 =====
-- (a) allow_all이 남아있는지 (있으면 안 됨)
SELECT
  COUNT(*) AS remaining_allow_all,
  COUNT(*) FILTER (WHERE pg_get_expr(p.polqual, p.polrelid) = 'true') AS remaining_true_policies
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND (p.polname ILIKE '%allow_all%'
       OR (pg_get_expr(p.polqual, p.polrelid) = 'true'
           AND p.polname NOT IN ('expense_categories_read','labor_grades_read','certificate_types_read','settings_read','attached_documents_auth')));
-- 결과: remaining_allow_all = 0 이 정상

-- (b) RLS 비활성 테이블 (있으면 안 됨)
SELECT COUNT(*) AS rls_disabled_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
-- 결과: rls_disabled_count = 0 이 정상

-- (c) 정책 0개인 테이블 (있으면 안 됨 — RLS 켜져있는데 정책 없으면 모든 접근 차단)
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
GROUP BY c.relname
HAVING COUNT(p.polname) = 0;
-- 결과: 0건이 정상 (정책 0개인 테이블은 service_role 빼고 누구도 접근 불가)
