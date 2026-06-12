-- =========================================================
-- 양식(template) 보관 Storage bucket (2026-06-11)
--
-- 용도: 경비정산/회계보고/견적/한글/엑셀 양식 보관
-- 구조:
--   templates/excel/         경비정산, 회계보고 등
--   templates/hwpx/          한글 양식
--   templates/word/          견적서 양식
--   templates/reports/       출력용 보고서
--
-- 보안:
--   - private bucket
--   - 인증된 사용자만 다운로드 가능 (직원도 양식 받아야 하므로)
--   - 업로드/삭제는 super_admin/company_admin만
-- =========================================================

-- 1) bucket 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('templates', 'templates', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2) 기존 정책 정리
DROP POLICY IF EXISTS "templates_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "templates_admin_write" ON storage.objects;

-- 3) 읽기: 인증된 사용자라면 모두 다운로드 가능
CREATE POLICY "templates_authenticated_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'templates');

-- 4) 쓰기/삭제: super_admin, company_admin만
CREATE POLICY "templates_admin_write" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'templates'
    AND current_user_role() IN ('super_admin', 'company_admin')
  )
  WITH CHECK (
    bucket_id = 'templates'
    AND current_user_role() IN ('super_admin', 'company_admin')
  );

-- 5) 검증
SELECT id, name, public FROM storage.buckets WHERE id = 'templates';
SELECT polname FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  WHERE c.relname = 'objects' AND polname LIKE 'templates_%';
