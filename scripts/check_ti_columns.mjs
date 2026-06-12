import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
// 빈 insert로 컬럼 확인
const test = {
  id: '00000000-0000-0000-0000-000000000099',
  company_id: 'a0000000-0000-0000-0000-000000000001',
  client_id: null,
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
const { error } = await sb.from('tax_invoices').insert(test);
console.log('insert error:', error?.message);
if (!error) {
  await sb.from('tax_invoices').delete().eq('id', test.id);
  console.log('스키마 OK');
}
