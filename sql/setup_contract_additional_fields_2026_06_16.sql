-- 추가기재요청사항 (2026-06-16): 계약(contracts)에 계약정보/금액정보 추가 필드
-- Supabase SQL Editor에서 실행. 모두 nullable/기본값 — 기존 데이터 영향 없음.

ALTER TABLE contracts
  -- 계약정보
  ADD COLUMN IF NOT EXISTS has_original_contract     BOOLEAN  DEFAULT false,   -- 원본계약서 유무
  ADD COLUMN IF NOT EXISTS contract_seal_shapes      JSONB    DEFAULT '[]'::jsonb, -- 계약도장[사용인감] 모양(복수): 마름모/세모/동그라미/네모
  ADD COLUMN IF NOT EXISTS statement_submitted       BOOLEAN  DEFAULT false,   -- 기성청구서및거래명세서 제출유무
  ADD COLUMN IF NOT EXISTS statement_submitted_date  DATE,                     -- 제출일
  -- 금액정보(직접입력)
  ADD COLUMN IF NOT EXISTS contract_deposit_amount   NUMERIC  DEFAULT 0,       -- 총계약보증금
  ADD COLUMN IF NOT EXISTS contract_deposit_rate     NUMERIC,                  -- 계약보증금율(%)
  ADD COLUMN IF NOT EXISTS guarantee_esubmission     TEXT,                     -- 계약보증서 전자제출여부: '전자접수및직접수납' | '지급각서로대체'
  ADD COLUMN IF NOT EXISTS defect_guarantee_rate     NUMERIC,                  -- 하자보수보증금율(%)
  ADD COLUMN IF NOT EXISTS defect_liability_months   INTEGER,                  -- 하자담보책임기간(개월)
  ADD COLUMN IF NOT EXISTS delay_penalty_rate        NUMERIC,                  -- 지체상금율(%)
  ADD COLUMN IF NOT EXISTS local_bond_applicable     BOOLEAN  DEFAULT false,   -- 지방채매입액 여부(해당/비해당)
  ADD COLUMN IF NOT EXISTS local_bond_amount         NUMERIC  DEFAULT 0,       -- 지방채매입액
  ADD COLUMN IF NOT EXISTS stamp_tax_applicable      BOOLEAN  DEFAULT false,   -- 인지세 과세 대상여부(해당/비해당)
  ADD COLUMN IF NOT EXISTS stamp_tax_amount          NUMERIC  DEFAULT 0;       -- 인지세액
