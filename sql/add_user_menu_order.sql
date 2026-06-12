-- =========================================================
-- 사용자별 메뉴 순서 커스터마이징
-- 실행: Supabase Dashboard → SQL Editor → New query → 붙여넣고 RUN
-- =========================================================

-- users 테이블에 menu_order 컬럼 추가 (jsonb array of group keys)
-- 예시 값: ["home", "contracts", "finance", "hr", "calendar", "admin", "system"]
ALTER TABLE users ADD COLUMN IF NOT EXISTS menu_order JSONB;

-- 검증
SELECT
  COUNT(*) AS total_users,
  COUNT(menu_order) AS with_order
FROM users;
