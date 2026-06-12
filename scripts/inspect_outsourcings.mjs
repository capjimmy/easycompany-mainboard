import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

// Try inserting a probe row with intentionally invalid columns to see schema
const testRow = { id: '00000000-0000-0000-0000-000000000099', company_id: 'a0000000-0000-0000-0000-000000000002', name: '__schema_test__' };
const { error } = await sb.from('outsourcings').insert(testRow);
console.log('insert error (reveals schema):', error?.message, error?.details, error?.hint);

// also test to delete
await sb.from('outsourcings').delete().eq('id', '00000000-0000-0000-0000-000000000099');

// Try select all columns
const { data, error: e2 } = await sb.from('outsourcings').select('*').limit(1);
console.log('select error:', e2?.message);
console.log('data:', data);
