-- =========================================================
-- 스키마 불일치 수정 (2026-05-27)
-- 실행: Supabase Dashboard → SQL Editor → New query → 붙여넣고 RUN
-- =========================================================

-- 1. 경비 정산 승인자 컬럼
ALTER TABLE expense_settlements
  ADD COLUMN IF NOT EXISTS approved_by UUID;

-- 2. 세금계산서 — client_name (조회/필터링용), payment_date (입금일)
ALTER TABLE tax_invoices
  ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE tax_invoices
  ADD COLUMN IF NOT EXISTS payment_date DATE;

-- buyer_name 기반으로 client_name 백필
UPDATE tax_invoices
SET client_name = COALESCE(client_name, buyer_name)
WHERE client_name IS NULL AND buyer_name IS NOT NULL;

-- 3. 청구 — client_name
ALTER TABLE billings
  ADD COLUMN IF NOT EXISTS client_name TEXT;

UPDATE billings
SET client_name = COALESCE(client_name, client_company_name)
WHERE client_name IS NULL AND client_company_name IS NOT NULL;

-- 4. 미수금 — client_name, expected_amount
ALTER TABLE receivables
  ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE receivables
  ADD COLUMN IF NOT EXISTS expected_amount NUMERIC DEFAULT 0;

UPDATE receivables
SET expected_amount = COALESCE(NULLIF(expected_amount, 0), original_amount, 0)
WHERE expected_amount IS NULL OR expected_amount = 0;

-- 5. 입금 — tax_invoice_id (세금계산서 연동)
ALTER TABLE payment_receipts
  ADD COLUMN IF NOT EXISTS tax_invoice_id UUID;

-- 검증
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='expense_settlements' AND column_name='approved_by') AS expense_approved_by,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='tax_invoices' AND column_name='client_name') AS ti_client_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='tax_invoices' AND column_name='payment_date') AS ti_payment_date,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='billings' AND column_name='client_name') AS billings_client_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='receivables' AND column_name='client_name') AS rc_client_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='receivables' AND column_name='expected_amount') AS rc_expected,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='payment_receipts' AND column_name='tax_invoice_id') AS pr_ti_id;
