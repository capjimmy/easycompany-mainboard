import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
// 빈 contact insert로 컬럼 보기
const { data: c1 } = await sb.from('client_contacts').select('*').limit(1);
console.log('샘플:', c1);
// 한 client_company 가져와서 test insert
const { data: cc } = await sb.from('client_companies').select('id').limit(1);
const test = {
  id: crypto.randomUUID(),
  client_company_id: cc[0].id,
  name: 'TEST',
  phone: '010-0000-0000',
  email: 'test@test.com',
  position: 'TEST',
  is_primary: false,
};
const { data, error } = await sb.from('client_contacts').insert(test).select().single();
console.log('test error:', error?.message);
console.log('컬럼:', Object.keys(data || {}));
if (data) await sb.from('client_contacts').delete().eq('id', test.id);
