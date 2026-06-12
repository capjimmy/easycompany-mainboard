import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { data } = await sb.from('quotes').select('id, source_file_path, notes').limit(5);
data.forEach((r, i) => {
  console.log(`\n[${i}]`);
  console.log('source_file_path:', r.source_file_path);
  console.log('notes:', r.notes?.slice(0, 200));
});
const { count: withPath } = await sb.from('quotes').select('*', { count: 'exact', head: true }).not('source_file_path', 'is', null);
console.log(`\nsource_file_path 있는 quotes: ${withPath}`);
