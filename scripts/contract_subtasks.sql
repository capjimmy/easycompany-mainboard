-- Contract Subtasks: 계약 세부작업 (대분류/세부/세세부)
CREATE TABLE IF NOT EXISTS contract_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES contract_subtasks(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1, -- 1=대분류, 2=세부, 3=세세부
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES users(id),
  assignee_name TEXT,
  progress_rate INTEGER DEFAULT 0, -- 0~100
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed
  start_date TEXT,
  end_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contract_subtasks_contract ON contract_subtasks(contract_id);
CREATE INDEX idx_contract_subtasks_parent ON contract_subtasks(parent_id);
