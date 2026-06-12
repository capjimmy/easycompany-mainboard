import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { count } = await sb.from('contracts').select('*', { count: 'exact', head: true });
console.log('contracts 총:', count);
const { count: q } = await sb.from('quotes').select('*', { count: 'exact', head: true });
console.log('quotes 총:', q);
