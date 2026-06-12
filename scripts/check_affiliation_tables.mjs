import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
for (const t of ['user_companies', 'user_departments']) {
  const { error } = await sb.from(t).select('id', { head: true });
  console.log(`${t}: ${error ? '❌ '+error.message : '✅'}`);
}
