import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const tables = ['receivables', 'deposits'];
for (const t of tables) {
  const { count: before } = await supabase.from(t).select('*', { count: 'exact', head: true });
  const { error } = await supabase.from(t).delete().not('id', 'is', null);
  console.log(`${t}: ${before} → 삭제 ${error ? '❌ ' + error.message : '✅'}`);
}
