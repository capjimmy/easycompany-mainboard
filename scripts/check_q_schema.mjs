import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

// 최소 필드만
const test = {
  id: crypto.randomUUID(),
  company_id: 'a0000000-0000-0000-0000-000000000001',
  quote_number: 'TEST-Q1',
  recipient_company: 'TEST',
};
const { data, error } = await sb.from('quotes').insert(test).select().single();
console.log('error:', error?.message);
if (data) {
  console.log('컬럼:', Object.keys(data));
  await sb.from('quotes').delete().eq('id', test.id);
}
