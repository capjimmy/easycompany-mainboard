import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const tables = ['users','companies','departments','client_companies','contracts','tax_invoices','payment_receipts','user_companies','user_departments'];
for (const t of tables) {
  const { count } = await sb.from(t).select('*', { count: 'exact', head: true });
  console.log(`${t}: ${count}`);
}
