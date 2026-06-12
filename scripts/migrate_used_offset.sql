-- 연차 사용량 수동 추가 컬럼 (시스템 도입 전 사용분 등)
ALTER TABLE users ADD COLUMN IF NOT EXISTS annual_leave_used_offset NUMERIC;
NOTIFY pgrst, 'reload schema';
