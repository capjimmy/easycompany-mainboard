-- =========================================================
-- 자동 업데이트용 Storage bucket 셋업 (2026-06-02)
--
-- bucket: app-updates (private)
-- 파일 구조:
--   windows/latest.yml
--   windows/건설경제연구원-1.7.36-setup.exe
--   windows/건설경제연구원-1.7.36-setup.exe.blockmap
--
-- 실행: Supabase Dashboard → SQL Editor → New query → 붙여넣고 RUN
-- =========================================================

-- 1) bucket 생성 (이미 있으면 무시)
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-updates', 'app-updates', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2) RLS 정책 — 직접 다운로드 차단 (Edge Function 경유로만 접근)
-- service_role은 항상 통과 (Edge Function에서 사용)
DROP POLICY IF EXISTS "app_updates_no_direct_select" ON storage.objects;
CREATE POLICY "app_updates_no_direct_select" ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket_id <> 'app-updates');

-- 슈퍼관리자는 업로드/수정/삭제 가능 (관리 화면용)
DROP POLICY IF EXISTS "app_updates_super_admin_write" ON storage.objects;
CREATE POLICY "app_updates_super_admin_write" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'app-updates'
    AND current_user_role() = 'super_admin'
  )
  WITH CHECK (
    bucket_id = 'app-updates'
    AND current_user_role() = 'super_admin'
  );

-- 3) 검증
SELECT id, name, public FROM storage.buckets WHERE id = 'app-updates';
-- public = false 여야 정상
