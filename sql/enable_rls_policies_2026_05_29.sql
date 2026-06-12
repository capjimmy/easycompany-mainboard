-- =========================================================
-- RLS 활성화 + 정책 작성 (2026-05-29)
-- 실행: Supabase Dashboard → SQL Editor → New query → 붙여넣고 RUN
--
-- ⚠️ 이 SQL 실행 시점부터:
-- - anon key로 모든 데이터 접근 차단됨
-- - service_role 키는 모든 정책 우회 (데스크톱 main process가 사용)
-- - 인증된 사용자(authenticated)는 본인/회사 데이터만 접근 가능
-- =========================================================

-- 헬퍼 함수가 없으면 먼저 auth_migration_prep_2026_05_29.sql 실행 필수

-- ===== 27개 테이블 RLS 활성화 =====
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE billings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE outsourcings ENABLE ROW LEVEL SECURITY;
ALTER TABLE provisional_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_settlement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attached_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_meeting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_amount_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_types ENABLE ROW LEVEL SECURITY;

-- ===== 정책 작성 =====
-- 패턴 1: 회사 단위 격리 (대부분 테이블)
-- - super_admin: 모든 회사 접근
-- - 그 외: 본인 회사만

-- users: 본인 + 관리자 가시성
DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users FOR SELECT TO authenticated USING (
  auth_user_id = auth.uid()
  OR current_user_role() = 'super_admin'
  OR (current_user_role() = 'company_admin' AND company_id = current_user_company_id())
);
DROP POLICY IF EXISTS users_update ON users;
CREATE POLICY users_update ON users FOR UPDATE TO authenticated USING (
  auth_user_id = auth.uid()
  OR current_user_role() = 'super_admin'
  OR (current_user_role() = 'company_admin' AND company_id = current_user_company_id())
);

-- companies: 본인 회사 + 슈퍼관리자
DROP POLICY IF EXISTS companies_select ON companies;
CREATE POLICY companies_select ON companies FOR SELECT TO authenticated USING (
  id = current_user_company_id() OR current_user_role() = 'super_admin'
);

-- departments: 회사 격리
DROP POLICY IF EXISTS departments_all ON departments;
CREATE POLICY departments_all ON departments FOR ALL TO authenticated USING (
  current_user_role() = 'super_admin' OR company_id = current_user_company_id()
);

-- 회사 단위 테이블들: 모두 동일 정책 (회사 격리)
-- ⚠️ company_id 컬럼이 실제로 존재하는 테이블만 포함
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'contracts','quotes','client_companies','tax_invoices','billings',
    'payment_receipts','receivables','payables','outsourcings',
    'provisional_payments','expense_settlements','expense_requests',
    'vehicles','vehicle_logs','spaces'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_company_iso ON %I', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_company_iso ON %I FOR ALL TO authenticated USING (
        current_user_role() = 'super_admin'
        OR company_id = current_user_company_id()
      )
    $f$, t, t);
  END LOOP;
END $$;

-- settings: 글로벌 key-value 테이블 (company_id 없음) — 인증 사용자 읽기, 관리자 쓰기
DROP POLICY IF EXISTS settings_read ON settings;
CREATE POLICY settings_read ON settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS settings_write ON settings;
CREATE POLICY settings_write ON settings FOR ALL TO authenticated USING (
  current_user_role() IN ('super_admin','company_admin')
);

-- attached_documents: parent_type/parent_id 다형성 (company_id 없음)
-- 인증 사용자 전체 허용 (UUID 모르면 접근 불가, 부모 엔티티 RLS로 간접 보호)
DROP POLICY IF EXISTS attached_documents_auth ON attached_documents;
CREATE POLICY attached_documents_auth ON attached_documents FOR ALL TO authenticated USING (true);

-- 사용자 단위 테이블 (본인 데이터만)
DROP POLICY IF EXISTS leave_self ON leave_requests;
CREATE POLICY leave_self ON leave_requests FOR ALL TO authenticated USING (
  current_user_role() IN ('super_admin', 'company_admin', 'department_manager')
  OR user_id = current_user_internal_id()
);

DROP POLICY IF EXISTS cert_self ON certificates;
CREATE POLICY cert_self ON certificates FOR ALL TO authenticated USING (
  current_user_role() IN ('super_admin', 'company_admin')
  OR user_id = current_user_internal_id()
);

-- 관계 테이블 (계약/견적 종속)
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'contract_events','contract_histories','contract_payments',
    'contract_members','contract_subtasks','contract_meeting_notes',
    'payment_conditions'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_via_contract ON %I', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_via_contract ON %I FOR ALL TO authenticated USING (
        current_user_role() = 'super_admin'
        OR contract_id IN (SELECT id FROM contracts WHERE company_id = current_user_company_id())
      )
    $f$, t, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS qs_via_quote ON quote_sections;
CREATE POLICY qs_via_quote ON quote_sections FOR ALL TO authenticated USING (
  current_user_role() = 'super_admin'
  OR quote_id IN (SELECT id FROM quotes WHERE company_id = current_user_company_id())
);

DROP POLICY IF EXISTS qah_via_quote ON quote_amount_histories;
CREATE POLICY qah_via_quote ON quote_amount_histories FOR ALL TO authenticated USING (
  current_user_role() = 'super_admin'
  OR quote_id IN (SELECT id FROM quotes WHERE company_id = current_user_company_id())
);

DROP POLICY IF EXISTS qm_via_quote ON quote_members;
CREATE POLICY qm_via_quote ON quote_members FOR ALL TO authenticated USING (
  current_user_role() = 'super_admin'
  OR quote_id IN (SELECT id FROM quotes WHERE company_id = current_user_company_id())
);

DROP POLICY IF EXISTS cc_via_client ON client_contacts;
CREATE POLICY cc_via_client ON client_contacts FOR ALL TO authenticated USING (
  current_user_role() = 'super_admin'
  OR client_company_id IN (SELECT id FROM client_companies WHERE company_id = current_user_company_id())
);

DROP POLICY IF EXISTS exp_item_via_settle ON expense_settlement_items;
CREATE POLICY exp_item_via_settle ON expense_settlement_items FOR ALL TO authenticated USING (
  current_user_role() = 'super_admin'
  OR settlement_id IN (SELECT id FROM expense_settlements WHERE company_id = current_user_company_id())
);

-- 알림: 본인만
DROP POLICY IF EXISTS notif_self ON notifications;
CREATE POLICY notif_self ON notifications FOR ALL TO authenticated USING (
  user_id = current_user_internal_id() OR current_user_role() = 'super_admin'
);

-- 메신저: 참여자만 (participants 컬럼 — uuid[] 또는 jsonb 양쪽 호환)
DROP POLICY IF EXISTS msg_participant ON messenger_messages;
CREATE POLICY msg_participant ON messenger_messages FOR ALL TO authenticated USING (
  current_user_role() = 'super_admin'
  OR conversation_id IN (
    SELECT id FROM messenger_conversations
    WHERE to_jsonb(participants) ? current_user_internal_id()::text
  )
);
DROP POLICY IF EXISTS conv_participant ON messenger_conversations;
CREATE POLICY conv_participant ON messenger_conversations FOR ALL TO authenticated USING (
  current_user_role() = 'super_admin'
  OR to_jsonb(participants) ? current_user_internal_id()::text
);

-- 마스터 데이터 (모두 읽기 허용)
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['expense_categories','labor_grades','certificate_types']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_read ON %I', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_read ON %I FOR SELECT TO authenticated USING (true)
    $f$, t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_write ON %I', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_write ON %I FOR ALL TO authenticated USING (
        current_user_role() IN ('super_admin','company_admin')
      )
    $f$, t, t);
  END LOOP;
END $$;

-- ===== 검증 =====
SELECT
  COUNT(*) FILTER (WHERE c.relrowsecurity) AS rls_enabled_tables,
  COUNT(*) AS total_public_tables
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';
-- rls_enabled_tables가 40이 나와야 정상 (40개 테이블 모두 RLS 켜짐)
