-- Add buyer_email column to tax_invoices table
ALTER TABLE tax_invoices ADD COLUMN IF NOT EXISTS buyer_email TEXT;
