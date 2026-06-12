-- Phase 3 Migration: 지출결의서, 차량관리, 운행일지
-- 적용: psql / Supabase SQL Editor

-- ============================================================
-- 1. 지출결의서 (expense_requests)
-- ============================================================
CREATE TABLE IF NOT EXISTS expense_requests (
  id            UUID PRIMARY KEY,
  company_id    UUID NOT NULL,
  requester_id  UUID NOT NULL,
  requester_name TEXT,
  title         TEXT NOT NULL,
  amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  category      TEXT,
  reason        TEXT,
  attachment_path TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending/approved/rejected
  approved_by   UUID,
  approved_at   TIMESTAMPTZ,
  reject_reason TEXT,
  expense_id    UUID,  -- 승인 시 expenses(expense_settlements) id 연동
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expense_requests_company ON expense_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_expense_requests_requester ON expense_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_expense_requests_status ON expense_requests(status);

-- ============================================================
-- 2. 차량 (vehicles)
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicles (
  id           UUID PRIMARY KEY,
  company_id   UUID NOT NULL,
  plate_number TEXT NOT NULL,
  vehicle_type TEXT,
  model        TEXT,
  color        TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicles_company ON vehicles(company_id);

-- ============================================================
-- 3. 운행일지 (vehicle_logs)
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicle_logs (
  id            UUID PRIMARY KEY,
  company_id    UUID NOT NULL,
  vehicle_id    UUID NOT NULL,
  driver_id     UUID NOT NULL,
  driver_name   TEXT,
  log_date      DATE NOT NULL,
  departure     TEXT,
  destination   TEXT,
  start_time    TEXT,
  end_time      TEXT,
  purpose       TEXT,
  distance_km   NUMERIC(10,2),
  fuel_cost     NUMERIC(15,2),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_logs_company ON vehicle_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_logs_driver ON vehicle_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_logs_vehicle ON vehicle_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_logs_date ON vehicle_logs(log_date);
