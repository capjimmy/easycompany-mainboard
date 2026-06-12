import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const tables = ['users','companies','departments','client_companies','client_contacts','quotes','contracts','tax_invoices','payment_receipts','contract_members','quote_members','expense_requests','leave_requests'];
for (const t of tables) {
  const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
  console.log(`${t}: ${error ? '❌ '+error.message : count+'건'}`);
}
