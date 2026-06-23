-- =========================================================
-- 2026-06-23 배치2: 계약 외주체크 / 세금계산서 입금액 / 가수금 출금·잔액 / 경영진 외주
-- 실행: Supabase Dashboard → SQL Editor → New query → 붙여넣고 RUN
-- 안전: 모든 ALTER에 IF NOT EXISTS / 신규 테이블 IF NOT EXISTS
-- =========================================================

-- A) 계약: 외주 여부 체크
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS is_outsourced BOOLEAN DEFAULT false;

-- B) 세금계산서: 실제 입금액(합계와 다를 수 있음) + 월별입금현황 자동연동용 참조키
ALTER TABLE tax_invoices ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(15,0);
ALTER TABLE monthly_deposits ADD COLUMN IF NOT EXISTS tax_invoice_id UUID;

-- C) 가수금: 출금액(남은가수금 = 입금액 - 출금액)
ALTER TABLE provisional_payments ADD COLUMN IF NOT EXISTS withdrawal_amount NUMERIC(15,0) DEFAULT 0;

-- D) 경영진 전용 외주관리 (일반 외주관리와 형식 동일, 데이터 분리)
CREATE TABLE IF NOT EXISTS executive_outsourcings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  contract_id UUID,
  contract_number TEXT,
  manual_service_name TEXT,
  vendor_name TEXT,
  vendor_type TEXT DEFAULT 'company',
  vendor_business_number TEXT,
  vendor_contact_name TEXT,
  vendor_contact_phone TEXT,
  vendor_contact_email TEXT,
  service_description TEXT,
  outsourcing_amount NUMERIC DEFAULT 0,
  vat_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  remaining_amount NUMERIC DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  show_on_calendar BOOLEAN DEFAULT false,
  vat_included BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE executive_outsourcings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS executive_outsourcings_isolation ON executive_outsourcings;
CREATE POLICY executive_outsourcings_isolation ON executive_outsourcings
  FOR ALL
  USING (current_user_role() = 'super_admin' OR company_id = current_user_company_id())
  WITH CHECK (current_user_role() = 'super_admin' OR company_id = current_user_company_id());

-- 검증
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='contracts' AND column_name='is_outsourced') AS contract_outsourced,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='tax_invoices' AND column_name='payment_amount') AS ti_payment_amount,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='monthly_deposits' AND column_name='tax_invoice_id') AS md_ti_ref,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='provisional_payments' AND column_name='withdrawal_amount') AS prov_withdrawal,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name='executive_outsourcings') AS exec_outsourcing_table;
