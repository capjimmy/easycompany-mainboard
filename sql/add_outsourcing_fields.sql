-- Add new fields to outsourcings table for C2, C5, C7
-- vendor_type: 'company' (업체) or 'individual' (개인)
-- show_on_calendar: boolean for calendar display toggle
-- vat_included: boolean for VAT option

ALTER TABLE outsourcings ADD COLUMN IF NOT EXISTS vendor_type TEXT DEFAULT 'company';
ALTER TABLE outsourcings ADD COLUMN IF NOT EXISTS show_on_calendar BOOLEAN DEFAULT false;
ALTER TABLE outsourcings ADD COLUMN IF NOT EXISTS vat_included BOOLEAN DEFAULT true;
