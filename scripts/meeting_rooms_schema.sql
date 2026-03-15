CREATE TABLE IF NOT EXISTS meeting_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  title TEXT NOT NULL,
  department TEXT,
  reserved_by UUID REFERENCES users(id),
  reserved_by_name TEXT,
  reservation_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_meeting_reservations_date ON meeting_reservations(reservation_date);
