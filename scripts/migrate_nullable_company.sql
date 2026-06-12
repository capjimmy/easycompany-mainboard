-- 차량/공간 테이블의 company_id를 nullable로 변경 (공통 옵션 지원)
ALTER TABLE vehicles ALTER COLUMN company_id DROP NOT NULL;
ALTER TABLE vehicle_logs ALTER COLUMN company_id DROP NOT NULL;
ALTER TABLE spaces ALTER COLUMN company_id DROP NOT NULL;
NOTIFY pgrst, 'reload schema';
