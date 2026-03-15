-- =============================================
-- KOC ERP Supabase Schema
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  business_number TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  ceo_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Departments
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_departments_company ON departments(company_id);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('super_admin','company_admin','department_manager','employee')),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  employee_number TEXT,
  rank TEXT,
  position TEXT,
  phone TEXT,
  direct_phone TEXT,
  hire_date TEXT,
  resignation_date TEXT,
  birth_date TEXT,
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relation TEXT,
  bank_name TEXT,
  bank_account TEXT,
  education JSONB DEFAULT '[]'::jsonb,
  certifications JSONB DEFAULT '[]'::jsonb,
  career_history JSONB DEFAULT '[]'::jsonb,
  extra_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_username ON users(username);

-- Menu Permissions
CREATE TABLE menu_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  menu_key TEXT NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_menu_permissions_user ON menu_permissions(user_id);

-- Settings (key-value)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sequences
CREATE TABLE sequences (
  key TEXT PRIMARY KEY,
  current_value INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Labor Grades
CREATE TABLE labor_grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  monthly_rate NUMERIC DEFAULT 0,
  daily_rate NUMERIC,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_labor_grades_company ON labor_grades(company_id);

-- Expense Categories
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  calculation_type TEXT DEFAULT 'manual',
  base_field TEXT,
  default_rate NUMERIC,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_expense_categories_company ON expense_categories(company_id);

-- Quotes
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  quote_number TEXT UNIQUE NOT NULL,
  recipient_company TEXT,
  recipient_contact TEXT,
  recipient_phone TEXT,
  recipient_email TEXT,
  recipient_department TEXT,
  recipient_address TEXT,
  project_period_months INTEGER,
  title TEXT,
  service_name TEXT,
  labor_total NUMERIC DEFAULT 0,
  expense_total NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  vat_amount NUMERIC DEFAULT 0,
  grand_total NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft',
  quote_date TEXT,
  valid_until TEXT,
  created_by TEXT,
  created_by_name TEXT,
  company_name TEXT,
  company_business_number TEXT,
  company_representative TEXT,
  company_address TEXT,
  company_phone TEXT,
  notes TEXT,
  source_file_path TEXT,
  converted_contract_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_quotes_company ON quotes(company_id);
CREATE INDEX idx_quotes_status ON quotes(status);

-- Quote Labor Items
CREATE TABLE quote_labor_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  grade_id TEXT,
  grade_name TEXT,
  quantity INTEGER DEFAULT 1,
  participation_rate NUMERIC DEFAULT 1,
  months NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  subtotal NUMERIC DEFAULT 0
);
CREATE INDEX idx_quote_labor_items_quote ON quote_labor_items(quote_id);

-- Quote Expense Items
CREATE TABLE quote_expense_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  category_id TEXT,
  category_name TEXT,
  amount NUMERIC DEFAULT 0,
  note TEXT
);
CREATE INDEX idx_quote_expense_items_quote ON quote_expense_items(quote_id);

-- Contracts
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contract_number TEXT UNIQUE NOT NULL,
  contract_code TEXT,
  quote_id UUID,
  client_business_number TEXT,
  client_company TEXT,
  client_contact_name TEXT,
  client_contact_phone TEXT,
  client_contact_email TEXT,
  contract_type TEXT DEFAULT 'service',
  service_category TEXT,
  service_name TEXT,
  description TEXT,
  contract_start_date TEXT,
  contract_end_date TEXT,
  contract_date TEXT,
  contract_amount NUMERIC DEFAULT 0,
  vat_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  vat_rate NUMERIC,
  progress TEXT DEFAULT 'contract_signed',
  progress_note TEXT,
  received_amount NUMERIC DEFAULT 0,
  remaining_amount NUMERIC DEFAULT 0,
  progress_billing_rate NUMERIC DEFAULT 0,
  progress_billing_amount NUMERIC DEFAULT 0,
  manager_id UUID,
  manager_name TEXT,
  department_id UUID,
  progress_rate NUMERIC DEFAULT 0,
  outsource_company TEXT,
  outsource_amount NUMERIC DEFAULT 0,
  source_quote_id UUID,
  notes TEXT,
  source_file_path TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_contracts_company ON contracts(company_id);
CREATE INDEX idx_contracts_progress ON contracts(progress);

-- Contract Histories
CREATE TABLE contract_histories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  change_type TEXT,
  change_description TEXT,
  field_name TEXT,
  previous_value TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT,
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_contract_histories_contract ON contract_histories(contract_id);

-- Contract Payments
CREATE TABLE contract_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  payment_date TEXT,
  amount NUMERIC DEFAULT 0,
  payment_method TEXT,
  note TEXT,
  notes TEXT,
  invoice_date TEXT,
  invoice_amount NUMERIC DEFAULT 0,
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_contract_payments_contract ON contract_payments(contract_id);

-- Contract Events
CREATE TABLE contract_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  event_title TEXT,
  event_type TEXT,
  event_date TEXT NOT NULL,
  event_description TEXT,
  description TEXT,
  event_color TEXT DEFAULT 'cyan',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_contract_events_contract ON contract_events(contract_id);

-- Client Companies
CREATE TABLE client_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  business_number TEXT,
  address TEXT,
  phone TEXT,
  industry TEXT,
  notes TEXT,
  ceo_name TEXT,
  fax TEXT,
  email TEXT,
  website TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_client_companies_company ON client_companies(company_id);

-- Client Contacts
CREATE TABLE client_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES client_companies(id) ON DELETE CASCADE,
  client_company_id UUID,
  name TEXT NOT NULL,
  position TEXT,
  department TEXT,
  phone TEXT,
  mobile TEXT,
  email TEXT,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_client_contacts_client ON client_contacts(client_id);

-- Outsourcings
CREATE TABLE outsourcings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  outsource_company TEXT,
  outsource_contact TEXT,
  outsource_phone TEXT,
  service_description TEXT,
  outsource_amount NUMERIC DEFAULT 0,
  budget NUMERIC DEFAULT 0,
  actual_cost NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  start_date TEXT,
  end_date TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_outsourcings_company ON outsourcings(company_id);

-- Document Templates
CREATE TABLE document_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  department_id UUID,
  template_type TEXT,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT,
  original_filename TEXT,
  stored_filename TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size BIGINT DEFAULT 0,
  field_mappings JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated Documents
CREATE TABLE generated_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  template_id TEXT,
  template_name TEXT,
  document_type TEXT,
  name TEXT,
  original_filename TEXT,
  stored_filename TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size BIGINT DEFAULT 0,
  data_snapshot JSONB,
  ai_content TEXT,
  ai_content_path TEXT,
  ai_generated BOOLEAN DEFAULT false,
  ai_error TEXT,
  status TEXT,
  generated_by TEXT,
  created_by_department_id UUID,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_generated_documents_contract ON generated_documents(contract_id);

-- Attached Documents
CREATE TABLE attached_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_type TEXT,
  parent_id UUID NOT NULL,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size BIGINT DEFAULT 0,
  category TEXT,
  description TEXT,
  attached_by TEXT,
  attached_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_attached_documents_parent ON attached_documents(parent_type, parent_id);

-- HWPX Templates
CREATE TABLE hwpx_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  doc_type TEXT,
  description TEXT,
  original_filename TEXT,
  stored_filename TEXT,
  file_path TEXT,
  file_size BIGINT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messenger Conversations
CREATE TABLE messenger_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT DEFAULT 'direct',
  title TEXT,
  participants TEXT[] DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messenger Messages
CREATE TABLE messenger_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  sender_id TEXT,
  sender_name TEXT,
  content TEXT,
  type TEXT DEFAULT 'text',
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messenger_messages_conv ON messenger_messages(conversation_id);
CREATE INDEX idx_messenger_messages_created ON messenger_messages(created_at);

-- Messenger Read Receipts
CREATE TABLE messenger_read_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  last_read_message_id UUID,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- =============================================
-- RLS Policies (permissive for now)
-- =============================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_labor_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE outsourcings ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE attached_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE hwpx_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON departments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON menu_permissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON sequences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON labor_grades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON expense_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON quotes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON quote_labor_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON quote_expense_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON contracts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON contract_histories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON contract_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON contract_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON client_companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON client_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON outsourcings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON document_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON generated_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON attached_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON hwpx_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON messenger_conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON messenger_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON messenger_read_receipts FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- Realtime for messenger
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE messenger_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE messenger_conversations;

-- =============================================
-- Triggers & Functions
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_client_companies_updated BEFORE UPDATE ON client_companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_labor_grades_updated BEFORE UPDATE ON labor_grades FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_expense_categories_updated BEFORE UPDATE ON expense_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_outsourcings_updated BEFORE UPDATE ON outsourcings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_document_templates_updated BEFORE UPDATE ON document_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hwpx_templates_updated BEFORE UPDATE ON hwpx_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_messenger_conversations_updated BEFORE UPDATE ON messenger_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Atomic sequence increment
CREATE OR REPLACE FUNCTION next_sequence(seq_key TEXT)
RETURNS INTEGER AS $$
DECLARE
  next_val INTEGER;
BEGIN
  INSERT INTO sequences (key, current_value, updated_at)
  VALUES (seq_key, 1, NOW())
  ON CONFLICT (key) DO UPDATE SET current_value = sequences.current_value + 1, updated_at = NOW()
  RETURNING current_value INTO next_val;
  RETURN next_val;
END;
$$ LANGUAGE plpgsql;
