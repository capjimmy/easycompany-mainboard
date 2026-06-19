-- =========================================================
-- 2026-06-19 경영관리부 요청 배치2: 경비내역 신규필드 / 외주 직접입력 / 월별입금현황
-- 실행 방법: Supabase Dashboard → SQL Editor → New query → 붙여넣고 RUN
-- 안전: 모든 ALTER에 IF NOT EXISTS / 신규 테이블은 IF NOT EXISTS
-- =========================================================

-- ---------------------------------------------------------
-- 1) 경비내역(경비 항목)에 신규 필드 추가
--    사용처 / 적요 / 사용처 사업자등록번호 / 결제수단 / 카드번호 / 개인카드 지급여부 / 사용 사업부
-- ---------------------------------------------------------
ALTER TABLE expense_settlement_items ADD COLUMN IF NOT EXISTS vendor_name TEXT;              -- 사용처
ALTER TABLE expense_settlement_items ADD COLUMN IF NOT EXISTS summary TEXT;                  -- 적요
ALTER TABLE expense_settlement_items ADD COLUMN IF NOT EXISTS vendor_business_number TEXT;   -- 사용처 사업자등록번호
ALTER TABLE expense_settlement_items ADD COLUMN IF NOT EXISTS payment_method TEXT;           -- 결제수단(corporate_card/auto_debit/account_transfer/withdrawal/personal_card)
ALTER TABLE expense_settlement_items ADD COLUMN IF NOT EXISTS card_number TEXT;              -- 법인카드 카드번호
ALTER TABLE expense_settlement_items ADD COLUMN IF NOT EXISTS settle_status TEXT;            -- 개인카드 지급여부(paid/unpaid)
ALTER TABLE expense_settlement_items ADD COLUMN IF NOT EXISTS department TEXT;               -- 경비사용 사업부

-- ---------------------------------------------------------
-- 2) 외주: 계약 미등록 시 용역명 직접입력 지원
--    - manual_service_name: 검색되지 않는 용역명 강제 기재
--    - contract_id NOT NULL 제약 제거 (직접입력은 계약 없이 등록 가능)
-- ---------------------------------------------------------
ALTER TABLE outsourcings ADD COLUMN IF NOT EXISTS manual_service_name TEXT;
ALTER TABLE outsourcings ALTER COLUMN contract_id DROP NOT NULL;

-- ---------------------------------------------------------
-- 3) 월별입금현황 전용 테이블
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS monthly_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  deposit_bank TEXT,                    -- 입금은행
  deposit_type TEXT,                    -- 입금구분(cash 현금 / b2b)
  tax_invoice_date DATE,               -- 세금계산서 발행일
  payment_date DATE,                   -- 입금일
  client_name TEXT,                    -- 거래업체
  project_name TEXT,                   -- 건명
  amount NUMERIC(15,0) DEFAULT 0,      -- 입금액
  vat_included BOOLEAN DEFAULT true,   -- 입금액 부가세 포함 여부(true 포함 / false 별도)
  department TEXT,                     -- 입금관련 사업부(건설/개발/학술/인증/기타)
  notes TEXT,                          -- 별도 참고사항(업체오류입금·은행간 이체 등)
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 데스크톱(service_role)은 RLS 우회. 웹(authenticated)을 위해 RLS + 회사격리 정책.
ALTER TABLE monthly_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS monthly_deposits_isolation ON monthly_deposits;
CREATE POLICY monthly_deposits_isolation ON monthly_deposits
  FOR ALL
  USING (
    current_user_role() = 'super_admin'
    OR company_id = current_user_company_id()
  )
  WITH CHECK (
    current_user_role() = 'super_admin'
    OR company_id = current_user_company_id()
  );

-- 검증
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'expense_settlement_items'
       AND column_name IN ('vendor_name','summary','vendor_business_number','payment_method','card_number','settle_status','department')) AS expense_new_cols,
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'outsourcings' AND column_name = 'manual_service_name') AS outsourcing_manual_col,
  (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_name = 'monthly_deposits') AS monthly_deposits_table;
