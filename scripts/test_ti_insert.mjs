import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

const { data: cl } = await sb.from('client_companies').select('id, company_id').limit(1);
const test = {
  id: crypto.randomUUID(),
  company_id: cl[0].company_id,
  client_company_id: cl[0].id,
  client_name: 'TEST',
  invoice_number: 'TEST-1',
  issue_date: '2024-01-01',
  supply_amount: 100,
  vat_amount: 10,
  total_amount: 110,
  item_description: 'test',
  status: 'issued',
  payment_date: null,
  notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
const { data, error } = await sb.from('tax_invoices').insert(test).select();
console.log('error:', error);
console.log('data:', data);
if (data) await sb.from('tax_invoices').delete().eq('id', test.id);
