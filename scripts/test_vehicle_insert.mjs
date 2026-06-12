import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const test = {
  id: crypto.randomUUID(),
  company_id: 'a0000000-0000-0000-0000-000000000001',
  plate_number: '12가1234',
  vehicle_type: 'sedan',
  model: '소나타',
};
const { data, error } = await sb.from('vehicles').insert(test).select();
console.log('error:', error);
console.log('컬럼:', Object.keys(data?.[0] || {}));
if (data) await sb.from('vehicles').delete().eq('id', test.id);
