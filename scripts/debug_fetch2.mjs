import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { data, error } = await sb.from('tax_invoices').select('id, contract_id, company_id, billing_id, invoice_number, total_amount, status, issue_date, item_description, notes').order('id').range(0, 999);
console.log('error:', error?.message);
console.log('data:', data?.length);
