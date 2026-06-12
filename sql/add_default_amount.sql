-- quote_preset_sections 테이블에 default_amount 컬럼 추가
ALTER TABLE quote_preset_sections ADD COLUMN IF NOT EXISTS default_amount BIGINT DEFAULT NULL;

COMMENT ON COLUMN quote_preset_sections.default_amount IS '세분류/세세분류의 기본 금액 (선택사항)';
