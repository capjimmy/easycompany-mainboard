-- ========================================
-- 대금조건 (Payment Conditions) 테이블
-- 착수금/중도금/잔금 관리
-- ========================================

CREATE TABLE IF NOT EXISTS payment_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  condition_type TEXT NOT NULL, -- 'advance' (착수금), 'interim' (중도금), 'balance' (잔금)
  title TEXT NOT NULL,
  amount BIGINT DEFAULT 0,
  percentage NUMERIC(5,2) DEFAULT 0,
  due_date TEXT,
  paid_date TEXT,
  paid_amount BIGINT DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'invoiced', 'paid', 'overdue'
  sort_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_conditions_contract ON payment_conditions(contract_id);

-- ========================================
-- 견적서 금액 변경이력 (Quote Amount Histories)
-- ========================================

CREATE TABLE IF NOT EXISTS quote_amount_histories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES users(id),
  changed_by_name TEXT,
  previous_labor_total BIGINT DEFAULT 0,
  new_labor_total BIGINT DEFAULT 0,
  previous_expense_total BIGINT DEFAULT 0,
  new_expense_total BIGINT DEFAULT 0,
  previous_total BIGINT DEFAULT 0,
  new_total BIGINT DEFAULT 0,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quote_amount_histories_quote ON quote_amount_histories(quote_id);
