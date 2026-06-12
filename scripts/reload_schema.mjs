import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

// 다양한 방법으로 schema cache reload 시도
console.log('schema cache reload 시도...');

// 1. select with full columns
const { data, error } = await sb.from('vehicles').select('*').limit(1);
console.log('select error:', error?.message);
console.log('컬럼:', data && data.length > 0 ? Object.keys(data[0]) : '(empty)');

// 직접 컬럼 명시
const { data: d2, error: e2 } = await sb.from('vehicles').select('id, company_id, plate_number, vehicle_type, model, color, notes, created_at, updated_at').limit(1);
console.log('\nselect 명시 error:', e2?.message);
