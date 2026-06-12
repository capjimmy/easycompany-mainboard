import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { data: cl } = await sb.from('client_companies').select('id, company_id, name').eq('name', '서울특별시미래한강본부').limit(1);
console.log('client:', cl);
const test = {
  id: crypto.randomUUID(),
  company_id: cl[0].company_id,
  client_company_id: cl[0].id,
  invoice_number: 'TEST-KEE-1',
  direction: 'issued',
  issue_date: '2024-02-01',
  supply_amount: 2681818,
  vat_amount: 0,
  total_amount: 2681818,
  supplier_name: '건설경제연구원',
  supplier_business_number: '',
  supplier_representative: '',
  buyer_name: '서울특별시미래한강본부',
  buyer_business_number: '',
  buyer_representative: '',
  item_description: 'TEST',
  status: 'paid',
  notes: 'test',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
const { data, error } = await sb.from('tax_invoices').insert(test).select();
console.log('error:', error);
console.log('data:', data);
if (data) await sb.from('tax_invoices').delete().eq('id', test.id);
