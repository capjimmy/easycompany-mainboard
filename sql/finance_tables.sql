-- ============================================================
-- H1-H8 재무/회계 모듈 테이블
-- ============================================================

-- H8. 거래처 재무정보 확장
CREATE TABLE IF NOT EXISTS client_company_financials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_company_id UUID NOT NULL REFERENCES client_companies(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  default_payment_terms INTEGER DEFAULT 30,
  credit_limit NUMERIC(15,0) DEFAULT 0,
  credit_rating TEXT DEFAULT 'normal',
  bank_name TEXT,
  bank_account TEXT,
  bank_holder TEXT,
  tax_type TEXT DEFAULT 'general',
  tax_email TEXT,
  total_receivable NUMERIC(15,0) DEFAULT 0,
  total_payable NUMERIC(15,0) DEFAULT 0,
  overdue_amount NUMERIC(15,0) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_company_id)
);

-- H1. 미수금
CREATE TABLE IF NOT EXISTS receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  client_company_id UUID REFERENCES client_companies(id) ON DELETE SET NULL,
  receivable_number TEXT,
  description TEXT,
  original_amount NUMERIC(15,0) NOT NULL DEFAULT 0,
  received_amount NUMERIC(15,0) DEFAULT 0,
  outstanding_amount NUMERIC(15,0) DEFAULT 0,
  issue_date DATE NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'outstanding',
  client_company_name TEXT,
  contract_number TEXT,
  service_name TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- H2. 청구
CREATE TABLE IF NOT EXISTS billings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  receivable_id UUID REFERENCES receivables(id) ON DELETE SET NULL,
  client_company_id UUID REFERENCES client_companies(id) ON DELETE SET NULL,
  billing_number TEXT,
  billing_type TEXT DEFAULT 'progress',
  description TEXT,
  billing_amount NUMERIC(15,0) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(15,0) DEFAULT 0,
  total_amount NUMERIC(15,0) DEFAULT 0,
  billing_date DATE NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'draft',
  client_company_name TEXT,
  contract_number TEXT,
  service_name TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- H2. 입금
CREATE TABLE IF NOT EXISTS payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  billing_id UUID REFERENCES billings(id) ON DELETE SET NULL,
  receivable_id UUID REFERENCES receivables(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  receipt_number TEXT,
  amount NUMERIC(15,0) NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL,
  payment_method TEXT DEFAULT 'transfer',
  depositor_name TEXT,
  bank_name TEXT,
  status TEXT DEFAULT 'confirmed',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- H3. 미지급금
CREATE TABLE IF NOT EXISTS payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  outsourcing_id UUID REFERENCES outsourcings(id) ON DELETE SET NULL,
  vendor_company_id UUID REFERENCES client_companies(id) ON DELETE SET NULL,
  payable_number TEXT,
  description TEXT,
  original_amount NUMERIC(15,0) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(15,0) DEFAULT 0,
  outstanding_amount NUMERIC(15,0) DEFAULT 0,
  issue_date DATE NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'outstanding',
  vendor_name TEXT,
  contract_number TEXT,
  service_description TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- H4. 보증금
CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  client_company_id UUID REFERENCES client_companies(id) ON DELETE SET NULL,
  deposit_number TEXT,
  deposit_type TEXT NOT NULL,
  direction TEXT DEFAULT 'received',
  amount NUMERIC(15,0) NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  return_date DATE,
  status TEXT DEFAULT 'active',
  client_company_name TEXT,
  contract_number TEXT,
  service_name TEXT,
  guarantee_number TEXT,
  guarantee_issuer TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- H5. 세금계산서
CREATE TABLE IF NOT EXISTS tax_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  billing_id UUID REFERENCES billings(id) ON DELETE SET NULL,
  payable_id UUID REFERENCES payables(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  outsourcing_id UUID REFERENCES outsourcings(id) ON DELETE SET NULL,
  client_company_id UUID REFERENCES client_companies(id) ON DELETE SET NULL,
  invoice_number TEXT,
  direction TEXT NOT NULL,
  supply_amount NUMERIC(15,0) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(15,0) DEFAULT 0,
  total_amount NUMERIC(15,0) DEFAULT 0,
  supplier_name TEXT,
  supplier_business_number TEXT,
  supplier_representative TEXT,
  buyer_name TEXT,
  buyer_business_number TEXT,
  buyer_representative TEXT,
  issue_date DATE NOT NULL,
  status TEXT DEFAULT 'draft',
  item_description TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- H6. 경비정산
CREATE TABLE IF NOT EXISTS expense_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  settlement_number TEXT,
  title TEXT NOT NULL,
  total_amount NUMERIC(15,0) DEFAULT 0,
  settlement_date DATE NOT NULL,
  status TEXT DEFAULT 'draft',
  approver_id UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expense_settlement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES expense_settlements(id) ON DELETE CASCADE,
  category_name TEXT,
  description TEXT NOT NULL,
  amount NUMERIC(15,0) NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL,
  receipt_attached BOOLEAN DEFAULT false,
  receipt_path TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- H7. 가수금
CREATE TABLE IF NOT EXISTS provisional_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  provisional_number TEXT,
  amount NUMERIC(15,0) NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL,
  depositor_name TEXT,
  bank_name TEXT,
  account_number TEXT,
  status TEXT DEFAULT 'unmatched',
  ai_suggestions JSONB,
  matched_receivable_id UUID REFERENCES receivables(id) ON DELETE SET NULL,
  matched_billing_id UUID REFERENCES billings(id) ON DELETE SET NULL,
  matched_amount NUMERIC(15,0) DEFAULT 0,
  matched_at TIMESTAMPTZ,
  matched_by UUID,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'client_company_financials', 'receivables', 'billings', 'payment_receipts',
    'payables', 'deposits', 'tax_invoices', 'expense_settlements',
    'expense_settlement_items', 'provisional_payments'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY "%s_select" ON %I FOR SELECT USING (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_insert" ON %I FOR INSERT WITH CHECK (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_update" ON %I FOR UPDATE USING (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_delete" ON %I FOR DELETE USING (true)', tbl, tbl);
  END LOOP;
END $$;
