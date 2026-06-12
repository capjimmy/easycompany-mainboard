-- =========================================================
-- 종합 스키마 수정 (2026-05-27) — 빈 테이블 audit 결과 반영
-- 실행: Supabase Dashboard → SQL Editor → New query → 붙여넣고 RUN
-- 이전에 create_missing_tables_2026_05_27.sql 안 실행했으면 그것도 함께
-- =========================================================

-- ===== 1. 누락 테이블 3개 =====
CREATE TABLE IF NOT EXISTS contract_meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL,
  title TEXT,
  content TEXT,
  meeting_date DATE,
  attendees TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cmn_contract ON contract_meeting_notes(contract_id);

CREATE TABLE IF NOT EXISTS quote_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL,
  section_type TEXT,
  title TEXT,
  content TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qs_quote ON quote_sections(quote_id);

CREATE TABLE IF NOT EXISTS expense_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  department_id UUID,
  request_date DATE,
  category TEXT,
  amount NUMERIC DEFAULT 0,
  description TEXT,
  attachment_path TEXT,
  status TEXT DEFAULT 'pending',
  approver_id UUID,
  approved_at TIMESTAMP,
  reject_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_er_company ON expense_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_er_user ON expense_requests(user_id);

-- ===== 2. billings: 청구 잔액 컬럼 (필수) =====
ALTER TABLE billings
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS received_amount NUMERIC DEFAULT 0;

-- ===== 3. payment_receipts: 메타/날짜 컬럼 =====
ALTER TABLE payment_receipts
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS received_date DATE,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS payer_name TEXT;
-- 기존 payment_date를 received_date로 백필
UPDATE payment_receipts SET received_date = payment_date
WHERE received_date IS NULL AND payment_date IS NOT NULL;

-- ===== 4. receivables: 미수 컬럼 =====
ALTER TABLE receivables
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_date DATE;

-- ===== 5. provisional_payments: 입금자/일자 =====
ALTER TABLE provisional_payments
  ADD COLUMN IF NOT EXISTS payer_name TEXT,
  ADD COLUMN IF NOT EXISTS received_date DATE;
-- depositor_name이 있으면 payer_name으로 백필
UPDATE provisional_payments SET payer_name = depositor_name
WHERE payer_name IS NULL AND depositor_name IS NOT NULL;

-- ===== 6. contract_events: 제목 =====
ALTER TABLE contract_events
  ADD COLUMN IF NOT EXISTS title TEXT;

-- ===== 7. vehicle_logs: 주행거리 =====
ALTER TABLE vehicle_logs
  ADD COLUMN IF NOT EXISTS start_km NUMERIC,
  ADD COLUMN IF NOT EXISTS end_km NUMERIC;

-- ===== 8. attached_documents: 표시명 / 업로더 =====
ALTER TABLE attached_documents
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by UUID;
-- file_name이 있으면 name으로 백필
UPDATE attached_documents SET name = file_name
WHERE name IS NULL AND file_name IS NOT NULL;

-- ===== 9. quote_amount_histories: 금액 비교 =====
ALTER TABLE quote_amount_histories
  ADD COLUMN IF NOT EXISTS previous_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS new_amount NUMERIC;

-- ===== 검증 =====
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name='contract_meeting_notes') AS t_cmn,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name='quote_sections') AS t_qs,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name='expense_requests') AS t_er,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='billings' AND column_name='paid_amount') AS billings_paid,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='payment_receipts' AND column_name='received_date') AS receipt_date,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='receivables' AND column_name='invoice_date') AS rc_inv_date,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='provisional_payments' AND column_name='payer_name') AS pp_payer,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='contract_events' AND column_name='title') AS ce_title,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='vehicle_logs' AND column_name='end_km') AS vl_km,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='attached_documents' AND column_name='name') AS ad_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='quote_amount_histories' AND column_name='new_amount') AS qah_amt;
-- 모두 1이 나와야 정상
