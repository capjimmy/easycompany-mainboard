-- 한 계약에 발주처(공동 발주) 여러 곳 + 발주처별 금액/수금 관리
-- Supabase SQL Editor에서 실행.

-- 1) 발주처 테이블
CREATE TABLE IF NOT EXISTS contract_clients (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id            uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  client_company         text NOT NULL,
  client_business_number text,
  client_contact_name    text,
  client_contact_phone   text,
  client_contact_email   text,
  amount                 numeric DEFAULT 0,   -- 각사 공급가(VAT 별도)
  vat_amount             numeric DEFAULT 0,
  total_amount           numeric DEFAULT 0,   -- 각사 총액(VAT 포함)
  billed_amount          numeric DEFAULT 0,   -- 각사 청구액 (청구/미청구 모니터링)
  received_amount        numeric DEFAULT 0,   -- 각사 수금액 (지급/미지급 모니터링)
  remaining_amount       numeric DEFAULT 0,   -- 각사 미수금
  sort_order             int DEFAULT 0,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contract_clients_contract ON contract_clients(contract_id);

-- 2) 수금(결제)에 발주처 연결 (어느 발주처 입금인지)
ALTER TABLE contract_payments
  ADD COLUMN IF NOT EXISTS contract_client_id uuid REFERENCES contract_clients(id) ON DELETE SET NULL;

-- 2-1) 청구(billings)에 발주처 연결 → 청구메뉴에서 발주처별 청구 발행 시 자동 집계
ALTER TABLE billings
  ADD COLUMN IF NOT EXISTS contract_client_id uuid REFERENCES contract_clients(id) ON DELETE SET NULL;

-- 2-2) 세부작업(subtasks)에 발주처 연결 → 발주처별 작업진행률 산출
ALTER TABLE contract_subtasks
  ADD COLUMN IF NOT EXISTS contract_client_id uuid REFERENCES contract_clients(id) ON DELETE SET NULL;

-- 3) RLS (기존 contract_*_items 와 동일 패턴: 회사격리 via contract)
ALTER TABLE contract_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contract_clients_via_contract ON contract_clients;
CREATE POLICY contract_clients_via_contract ON contract_clients FOR ALL TO authenticated USING (
  current_user_role() = 'super_admin'
  OR contract_id IN (SELECT id FROM contracts WHERE company_id = current_user_company_id())
);
