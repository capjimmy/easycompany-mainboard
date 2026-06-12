import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

// 빈 insert로 사용 가능한 컬럼 확인
const test = {
  id: crypto.randomUUID(),
  company_id: 'a0000000-0000-0000-0000-000000000001',
  contract_number: 'TEST-1',
  client_company: 'TEST',
};
const { data, error } = await sb.from('contracts').insert(test).select().single();
console.log('contracts insert error:', error?.message);
if (data) {
  console.log('contracts 컬럼:', Object.keys(data));
  await sb.from('contracts').delete().eq('id', test.id);
}

const test2 = {
  id: crypto.randomUUID(),
  company_id: 'a0000000-0000-0000-0000-000000000001',
  quote_number: 'TEST-Q1',
  client_company: 'TEST',
};
const { data: d2, error: e2 } = await sb.from('quotes').insert(test2).select().single();
console.log('\nquotes insert error:', e2?.message);
if (d2) {
  console.log('quotes 컬럼:', Object.keys(d2));
  await sb.from('quotes').delete().eq('id', test2.id);
}
