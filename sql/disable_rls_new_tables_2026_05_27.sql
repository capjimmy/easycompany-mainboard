-- =========================================================
-- 신규 테이블 3개 RLS 비활성화 (다른 테이블들과 동일하게)
-- 실행: Supabase Dashboard → SQL Editor → New query → 붙여넣고 RUN
--
-- 사유: 새 테이블 생성 시 RLS가 강제 켜져 있어서 anon key 접근 차단됨.
--      다른 기존 테이블들과 동일 정책 (RLS 비활성)으로 맞춤.
--      ※ 영구 공개 시점에는 RLS 정책 정비가 별도 작업으로 필요.
-- =========================================================

ALTER TABLE contract_meeting_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE quote_sections DISABLE ROW LEVEL SECURITY;
ALTER TABLE expense_requests DISABLE ROW LEVEL SECURITY;

-- 검증
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('contract_meeting_notes', 'quote_sections', 'expense_requests');
-- 세 행 모두 rls_enabled = false 가 정상
