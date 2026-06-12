import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
for (const t of ['vehicles', 'vehicle_logs', 'expense_requests']) {
  const { error } = await sb.from(t).select('id', { head: true, count: 'exact' });
  console.log(`${t}: ${error ? '❌ ' + error.message : '✅'}`);
}
